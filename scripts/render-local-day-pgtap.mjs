import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(readFileSync(join(root, 'fixtures/local-day.json'), 'utf8'));
const cases = fixture.cases;
if (!Array.isArray(cases) || cases.length === 0) {
  throw new Error('fixtures/local-day.json has no cases');
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function shiftDay(localDay, days) {
  const [year, month, day] = localDay.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function uuid(n) {
  return `44444444-4444-4444-8444-${String(n).padStart(12, '0')}`;
}

const civilChecks = cases.map(
  (item) => `select is(
  (select (timestamptz ${sqlString(item.recordedAt)} at time zone ${sqlString(item.tz)})::date),
  date ${sqlString(item.civilDay)},
  ${sqlString(`${item.id} civil day in ${item.tz}`)}
);`,
);

const writes = cases.flatMap((item, index) => {
  const rejected = shiftDay(item.civilDay, -2);
  const when = `timestamptz ${sqlString(item.recordedAt)}`;
  const zone = sqlString(item.tz);
  return [
    `select lives_ok(
  $$insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values ('${uuid(index + 1)}', 70.50, ${when}, ${zone}, date ${sqlString(item.localDay)})$$,
  ${sqlString(`${item.id} local_day ${item.localDay} with day switch ${item.daySwitch} is accepted`)}
);`,
    `select throws_ok(
  $$insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values ('${uuid(index + 101)}', 70.50, ${when}, ${zone}, date ${sqlString(rejected)})$$,
  '23514',
  NULL::text,
  ${sqlString(`${item.id} rejects a local_day two days before the civil date`)}
);`,
  ];
});

const assertionCount = civilChecks.length + 3 + writes.length;

const sql = `-- Generated from fixtures/local-day.json by scripts/render-local-day-pgtap.mjs. Do not edit.
begin;

create schema if not exists tests;

create or replace function tests.create_supabase_user(identifier text, email text)
returns uuid
language plpgsql
set search_path = auth, public, extensions, pg_temp
as $$
declare
  user_id uuid := gen_random_uuid();
  col record;
  insert_cols text[] := array[
    'id', 'email', 'aud', 'role', 'instance_id',
    'raw_app_meta_data', 'raw_user_meta_data', 'created_at', 'updated_at', 'email_confirmed_at'
  ];
  insert_vals text[] := array[
    quote_literal(user_id::text) || '::uuid',
    quote_literal(email),
    quote_literal('authenticated'),
    quote_literal('authenticated'),
    quote_literal('00000000-0000-0000-0000-000000000000') || '::uuid',
    quote_literal('{"provider":"email","providers":["email"]}') || '::jsonb',
    quote_literal(jsonb_build_object('test_identifier', identifier)::text) || '::jsonb',
    'now()', 'now()', 'now()'
  ];
begin
  for col in
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and is_nullable = 'NO'
      and column_default is null
      and is_generated = 'NEVER'
      and column_name <> all (insert_cols)
  loop
    insert_cols := insert_cols || quote_ident(col.column_name);
    if col.data_type in ('text', 'character varying') then
      insert_vals := insert_vals || quote_literal('');
    elsif col.data_type = 'boolean' then
      insert_vals := insert_vals || 'false';
    elsif col.data_type = 'jsonb' then
      insert_vals := insert_vals || '''{}''::jsonb';
    elsif col.data_type in ('integer', 'bigint', 'smallint') then
      insert_vals := insert_vals || '0';
    elsif col.data_type like 'timestamp%' then
      insert_vals := insert_vals || 'now()';
    elsif col.data_type = 'uuid' then
      insert_vals := insert_vals || quote_literal('00000000-0000-0000-0000-000000000000') || '::uuid';
    else
      raise exception 'cannot default auth.users.% of type %', col.column_name, col.data_type;
    end if;
  end loop;

  execute format(
    'insert into auth.users (%s) values (%s)',
    array_to_string(insert_cols, ', '),
    array_to_string(insert_vals, ', ')
  );
  return user_id;
end;
$$;

select plan(${assertionCount});

do $$
declare
  user_id uuid;
begin
  user_id := tests.create_supabase_user('vector_user', 'vector@viastela.test');
  perform set_config('tests.vector_user', user_id::text, true);
end $$;

${civilChecks.join('\n')}

select is(
  set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('tests.vector_user'), 'role', 'authenticated')::text,
    true
  ),
  json_build_object('sub', current_setting('tests.vector_user'), 'role', 'authenticated')::text,
  'jwt claims identify the vector user'
);
select is(
  set_config('request.jwt.claim.sub', current_setting('tests.vector_user'), true),
  current_setting('tests.vector_user'),
  'jwt sub is the vector user'
);
set local role authenticated;

select is(auth.uid()::text, current_setting('tests.vector_user'), 'auth.uid() is the vector user');

${writes.join('\n')}

reset role;

select * from finish();
rollback;
`;

writeFileSync(join(root, 'supabase/tests/local_day_vectors.test.sql'), sql);
