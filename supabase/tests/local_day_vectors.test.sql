-- Generated from fixtures/local-day.json by scripts/render-local-day-pgtap.mjs. Do not edit.
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

select plan(24);

do $$
declare
  user_id uuid;
begin
  user_id := tests.create_supabase_user('vector_user', 'vector@viastela.test');
  perform set_config('tests.vector_user', user_id::text, true);
end $$;

select is(
  (select (timestamptz '2026-10-23T17:30:00.000Z' at time zone 'Asia/Singapore')::date),
  date '2026-10-24',
  'singapore-0130 civil day in Asia/Singapore'
);
select is(
  (select (timestamptz '2026-10-23T19:59:00.000Z' at time zone 'Asia/Singapore')::date),
  date '2026-10-24',
  'singapore-0359 civil day in Asia/Singapore'
);
select is(
  (select (timestamptz '2026-10-23T20:00:00.000Z' at time zone 'Asia/Singapore')::date),
  date '2026-10-24',
  'singapore-0400 civil day in Asia/Singapore'
);
select is(
  (select (timestamptz '2026-02-28T17:30:00.000Z' at time zone 'Asia/Singapore')::date),
  date '2026-03-01',
  'singapore-month-boundary civil day in Asia/Singapore'
);
select is(
  (select (timestamptz '2026-10-23T19:30:00.000Z' at time zone 'Asia/Singapore')::date),
  date '2026-10-24',
  'singapore-0330 civil day in Asia/Singapore'
);
select is(
  (select (timestamptz '2026-10-23T19:30:00.000Z' at time zone 'Asia/Tokyo')::date),
  date '2026-10-24',
  'tokyo-0430-same-instant civil day in Asia/Tokyo'
);
select is(
  (select (timestamptz '2026-10-23T21:30:00.000Z' at time zone 'Asia/Singapore')::date),
  date '2026-10-24',
  'singapore-0530-switch-0600 civil day in Asia/Singapore'
);

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

select lives_ok(
  $$insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values ('44444444-4444-4444-8444-000000000001', 70.50, timestamptz '2026-10-23T17:30:00.000Z', 'Asia/Singapore', date '2026-10-23')$$,
  'singapore-0130 local_day 2026-10-23 with day switch 04:00 is accepted'
);
select throws_ok(
  $$insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values ('44444444-4444-4444-8444-000000000101', 70.50, timestamptz '2026-10-23T17:30:00.000Z', 'Asia/Singapore', date '2026-10-22')$$,
  '23514',
  'singapore-0130 rejects a local_day two days before the civil date'
);
select lives_ok(
  $$insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values ('44444444-4444-4444-8444-000000000002', 70.50, timestamptz '2026-10-23T19:59:00.000Z', 'Asia/Singapore', date '2026-10-23')$$,
  'singapore-0359 local_day 2026-10-23 with day switch 04:00 is accepted'
);
select throws_ok(
  $$insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values ('44444444-4444-4444-8444-000000000102', 70.50, timestamptz '2026-10-23T19:59:00.000Z', 'Asia/Singapore', date '2026-10-22')$$,
  '23514',
  'singapore-0359 rejects a local_day two days before the civil date'
);
select lives_ok(
  $$insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values ('44444444-4444-4444-8444-000000000003', 70.50, timestamptz '2026-10-23T20:00:00.000Z', 'Asia/Singapore', date '2026-10-24')$$,
  'singapore-0400 local_day 2026-10-24 with day switch 04:00 is accepted'
);
select throws_ok(
  $$insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values ('44444444-4444-4444-8444-000000000103', 70.50, timestamptz '2026-10-23T20:00:00.000Z', 'Asia/Singapore', date '2026-10-22')$$,
  '23514',
  'singapore-0400 rejects a local_day two days before the civil date'
);
select lives_ok(
  $$insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values ('44444444-4444-4444-8444-000000000004', 70.50, timestamptz '2026-02-28T17:30:00.000Z', 'Asia/Singapore', date '2026-02-28')$$,
  'singapore-month-boundary local_day 2026-02-28 with day switch 04:00 is accepted'
);
select throws_ok(
  $$insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values ('44444444-4444-4444-8444-000000000104', 70.50, timestamptz '2026-02-28T17:30:00.000Z', 'Asia/Singapore', date '2026-02-27')$$,
  '23514',
  'singapore-month-boundary rejects a local_day two days before the civil date'
);
select lives_ok(
  $$insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values ('44444444-4444-4444-8444-000000000005', 70.50, timestamptz '2026-10-23T19:30:00.000Z', 'Asia/Singapore', date '2026-10-23')$$,
  'singapore-0330 local_day 2026-10-23 with day switch 04:00 is accepted'
);
select throws_ok(
  $$insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values ('44444444-4444-4444-8444-000000000105', 70.50, timestamptz '2026-10-23T19:30:00.000Z', 'Asia/Singapore', date '2026-10-22')$$,
  '23514',
  'singapore-0330 rejects a local_day two days before the civil date'
);
select lives_ok(
  $$insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values ('44444444-4444-4444-8444-000000000006', 70.50, timestamptz '2026-10-23T19:30:00.000Z', 'Asia/Tokyo', date '2026-10-24')$$,
  'tokyo-0430-same-instant local_day 2026-10-24 with day switch 04:00 is accepted'
);
select throws_ok(
  $$insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values ('44444444-4444-4444-8444-000000000106', 70.50, timestamptz '2026-10-23T19:30:00.000Z', 'Asia/Tokyo', date '2026-10-22')$$,
  '23514',
  'tokyo-0430-same-instant rejects a local_day two days before the civil date'
);
select lives_ok(
  $$insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values ('44444444-4444-4444-8444-000000000007', 70.50, timestamptz '2026-10-23T21:30:00.000Z', 'Asia/Singapore', date '2026-10-23')$$,
  'singapore-0530-switch-0600 local_day 2026-10-23 with day switch 06:00 is accepted'
);
select throws_ok(
  $$insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values ('44444444-4444-4444-8444-000000000107', 70.50, timestamptz '2026-10-23T21:30:00.000Z', 'Asia/Singapore', date '2026-10-22')$$,
  '23514',
  'singapore-0530-switch-0600 rejects a local_day two days before the civil date'
);

reset role;

select * from finish();
rollback;
