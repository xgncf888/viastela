-- Role changes happen in this script with `set local role`.
-- Postgres rejects SET ROLE inside a security-definer function, so there is no helper that switches role.
begin;

create schema if not exists tests;

-- Inserts into auth.users only. Does not change the session role.
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

select plan(58);

do $$
declare
  user_a uuid;
  user_b uuid;
begin
  user_a := tests.create_supabase_user('user_a', 'user-a@viastela.test');
  user_b := tests.create_supabase_user('user_b', 'user-b@viastela.test');
  perform set_config('tests.user_a', user_a::text, true);
  perform set_config('tests.user_b', user_b::text, true);
end $$;

select is(
  coalesce((
    select string_agg(c.relname, ',' order by c.relname)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  ), ''),
  '',
  'every table in public has RLS enabled'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.weight_records'::regclass),
  'RLS is enabled on weight_records'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS is enabled on profiles'
);

select is(
  set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('tests.user_a'), 'role', 'authenticated')::text,
    true
  ),
  json_build_object('sub', current_setting('tests.user_a'), 'role', 'authenticated')::text,
  'jwt claims identify user A'
);
select is(
  set_config('request.jwt.claim.sub', current_setting('tests.user_a'), true),
  current_setting('tests.user_a'),
  'jwt sub is user A'
);
set local role authenticated;

select is(auth.uid()::text, current_setting('tests.user_a'), 'auth.uid() is user A');

select lives_ok(
  $$
    insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values (
      '11111111-1111-4111-8111-111111111111',
      70.50,
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
  $$,
  'user A can insert a weight record'
);

select is(
  (select count(*) from public.weight_records),
  1::bigint,
  'user A can read their own weight record'
);

select is(
  (select count(*) from public.profiles where user_id = current_setting('tests.user_a')::uuid),
  1::bigint,
  'user A can read their own profile'
);

select lives_ok(
  $$
    do $body$
    declare
      affected integer;
    begin
      update public.weight_records
      set weight_kg = 71
      where id = '11111111-1111-4111-8111-111111111111';
      get diagnostics affected = row_count;
      if affected is distinct from 1 then
        raise exception 'updated % rows, expected 1', affected;
      end if;
    end
    $body$;
  $$,
  'user A can update their own weight record'
);

select lives_ok(
  $$
    do $body$
    declare
      affected integer;
    begin
      update public.profiles
      set day_switch = time '05:30'
      where user_id = current_setting('tests.user_a')::uuid;
      get diagnostics affected = row_count;
      if affected is distinct from 1 then
        raise exception 'updated % rows, expected 1', affected;
      end if;
    end
    $body$;
  $$,
  'user A can update their own profile'
);

reset role;

select is(
  set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('tests.user_b'), 'role', 'authenticated')::text,
    true
  ),
  json_build_object('sub', current_setting('tests.user_b'), 'role', 'authenticated')::text,
  'jwt claims identify user B'
);
select is(
  set_config('request.jwt.claim.sub', current_setting('tests.user_b'), true),
  current_setting('tests.user_b'),
  'jwt sub is user B'
);
set local role authenticated;

select is(auth.uid()::text, current_setting('tests.user_b'), 'auth.uid() is user B');

select is(
  (select count(*) from public.weight_records),
  0::bigint,
  'user B cannot read user A weight records'
);

select is(
  (select count(*) from public.profiles where user_id = current_setting('tests.user_a')::uuid),
  0::bigint,
  'user B cannot read user A profile'
);

select is(
  (select count(*) from public.profiles where user_id = current_setting('tests.user_b')::uuid),
  1::bigint,
  'user B can read their own profile'
);

select lives_ok(
  $$
    do $body$
    declare
      affected integer;
    begin
      update public.weight_records
      set weight_kg = 99
      where id = '11111111-1111-4111-8111-111111111111';
      get diagnostics affected = row_count;
      if affected is distinct from 0 then
        raise exception 'updated % rows, expected 0', affected;
      end if;
    end
    $body$;
  $$,
  'user B cannot update user A weight records'
);

select lives_ok(
  $$
    do $body$
    declare
      affected integer;
    begin
      update public.profiles
      set day_switch = time '06:00'
      where user_id = current_setting('tests.user_a')::uuid;
      get diagnostics affected = row_count;
      if affected is distinct from 0 then
        raise exception 'updated % rows, expected 0', affected;
      end if;
    end
    $body$;
  $$,
  'user B cannot update user A profile'
);

select throws_ok(
  $$delete from public.weight_records where id = '11111111-1111-4111-8111-111111111111'$$,
  '42501',
  NULL::text,
  'authenticated hard delete of a weight record is rejected'
);

select lives_ok(
  $$
    do $body$
    declare
      affected integer;
    begin
      delete from public.profiles
      where user_id = current_setting('tests.user_a')::uuid;
      get diagnostics affected = row_count;
      if affected is distinct from 0 then
        raise exception 'deleted % rows, expected 0', affected;
      end if;
    end
    $body$;
  $$,
  'user B cannot delete user A profile'
);

select throws_ok(
  $$
    insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values (
      '11111111-1111-4111-8111-111111111111',
      99,
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
    on conflict (id) do update set weight_kg = excluded.weight_kg
  $$,
  '42501',
  NULL::text,
  'user B cannot upsert user A weight id'
);

select throws_ok(
  $$insert into public.profiles (user_id) values (current_setting('tests.user_a')::uuid)$$,
  '42501',
  NULL::text,
  'user B cannot insert a profile for user A'
);

select throws_ok(
  $$select public.soft_delete_weight_record('11111111-1111-4111-8111-111111111111')$$,
  'P0002',
  NULL::text,
  'user B cannot soft-delete user A weight record'
);

reset role;

select ok(
  (select weight_kg = 71 from public.weight_records where id = '11111111-1111-4111-8111-111111111111'),
  'user A weight is unchanged after user B upsert and updates'
);

select ok(
  (select day_switch = time '05:30' from public.profiles where user_id = current_setting('tests.user_a')::uuid),
  'user A day switch is unchanged after user B update'
);

select is(
  set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('tests.user_a'), 'role', 'authenticated')::text,
    true
  ),
  json_build_object('sub', current_setting('tests.user_a'), 'role', 'authenticated')::text,
  'jwt claims identify user A again'
);
select is(
  set_config('request.jwt.claim.sub', current_setting('tests.user_a'), true),
  current_setting('tests.user_a'),
  'jwt sub is user A again'
);
set local role authenticated;

select is(auth.uid()::text, current_setting('tests.user_a'), 'auth.uid() is user A again');

select throws_ok(
  $$delete from public.weight_records where id = '11111111-1111-4111-8111-111111111111'$$,
  '42501',
  NULL::text,
  'authenticated hard delete of their own weight record is rejected'
);

select lives_ok(
  $$select public.soft_delete_weight_record('11111111-1111-4111-8111-111111111111')$$,
  'user A can soft-delete their own weight record'
);

select throws_ok(
  $$
    insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values (
      '11111111-1111-4111-8111-111111111111',
      71,
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
    on conflict (id) do update set weight_kg = excluded.weight_kg
  $$,
  'P0001',
  'record deleted',
  'upsert of a soft-deleted weight id errors with record deleted'
);

select is(
  (select count(*) from public.weight_records),
  1::bigint,
  'user A can see their own soft-deleted weight record'
);

select lives_ok(
  $$
    do $body$
    declare
      affected integer;
    begin
      delete from public.profiles
      where user_id = auth.uid();
      get diagnostics affected = row_count;
      if affected is distinct from 1 then
        raise exception 'deleted % rows, expected 1', affected;
      end if;
    end
    $body$;
  $$,
  'user A can delete their own profile'
);

select lives_ok(
  $$insert into public.profiles (user_id) values (auth.uid())$$,
  'user A can insert their own profile'
);

reset role;

select ok(
  (
    select deleted_at is not null and weight_kg = 71
    from public.weight_records
    where id = '11111111-1111-4111-8111-111111111111'
  ),
  'soft-deleted weight stays stored with the original kilograms'
);

select is(
  (select count(*) from public.profiles where user_id = current_setting('tests.user_a')::uuid),
  1::bigint,
  'user A profile exists after they insert it again'
);

select is(
  set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('tests.user_a'), 'role', 'authenticated')::text,
    true
  ),
  json_build_object('sub', current_setting('tests.user_a'), 'role', 'authenticated')::text,
  'jwt claims identify user A for validity checks'
);
select is(
  set_config('request.jwt.claim.sub', current_setting('tests.user_a'), true),
  current_setting('tests.user_a'),
  'jwt sub is user A for validity checks'
);
set local role authenticated;

select throws_ok(
  $$
    insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values (
      '33333333-3333-4333-8333-333333333331',
      0,
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
  $$,
  '23514',
  NULL::text,
  'weight of 0 kg is rejected'
);

select throws_ok(
  $$
    insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values (
      '33333333-3333-4333-8333-333333333332',
      500,
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
  $$,
  '23514',
  NULL::text,
  'weight of 500 kg is rejected'
);

select throws_ok(
  $$
    insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values (
      '33333333-3333-4333-8333-333333333330',
      -1,
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
  $$,
  '23514',
  NULL::text,
  'negative weight is rejected'
);

select lives_ok(
  $$
    insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values (
      '33333333-3333-4333-8333-333333333333',
      499.99,
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
  $$,
  'weight just under 500 kg is accepted'
);

select throws_ok(
  $$delete from public.weight_records where id = '33333333-3333-4333-8333-333333333333'$$,
  '42501',
  NULL::text,
  'authenticated hard delete of a weight record is rejected'
);

select throws_ok(
  $$
    insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values (
      '66666666-6666-4666-8666-666666666666',
      70.50,
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-22'
    )
  $$,
  '23514',
  NULL::text,
  'local_day two days before the civil date is rejected'
);

select throws_ok(
  $$
    insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values (
      '77777777-7777-4777-8777-777777777777',
      70.50,
      timestamptz '2026-10-23 20:00:00+00',
      'Not/AZone',
      date '2026-10-24'
    )
  $$,
  '22023',
  NULL::text,
  'an unknown timezone is rejected'
);

reset role;

select is(
  set_config('request.jwt.claims', '', true),
  '',
  'anon jwt claims are cleared'
);
select is(
  set_config('request.jwt.claim.sub', '', true),
  '',
  'anon jwt sub is cleared'
);
set local role anon;

select throws_ok($$select count(*) from public.weight_records$$, '42501', NULL::text, 'anon cannot select weight records');
select throws_ok(
  $$
    insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values (
      '99999999-9999-4999-8999-999999999999',
      70.50,
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
  $$,
  '42501',
  NULL::text,
  'anon cannot insert weight records'
);
select throws_ok(
  $$update public.weight_records set weight_kg = 80 where id = '11111111-1111-4111-8111-111111111111'$$,
  '42501',
  NULL::text,
  'anon cannot update weight records'
);
select throws_ok(
  $$delete from public.weight_records where id = '11111111-1111-4111-8111-111111111111'$$,
  '42501',
  NULL::text,
  'anon cannot delete weight records'
);
select throws_ok($$select count(*) from public.profiles$$, '42501', NULL::text, 'anon cannot select profiles');
select throws_ok(
  $$insert into public.profiles (user_id) values ('11111111-1111-4111-8111-111111111111')$$,
  '42501',
  NULL::text,
  'anon cannot insert profiles'
);
select throws_ok(
  $$update public.profiles set day_switch = time '04:00' where user_id = current_setting('tests.user_a')::uuid$$,
  '42501',
  NULL::text,
  'anon cannot update profiles'
);
select throws_ok(
  $$delete from public.profiles where user_id = current_setting('tests.user_a')::uuid$$,
  '42501',
  NULL::text,
  'anon cannot delete profiles'
);
select throws_ok(
  $$select public.soft_delete_weight_record('11111111-1111-4111-8111-111111111111')$$,
  '42501',
  NULL::text,
  'anon cannot soft-delete weight records'
);

reset role;

select ok(
  (
    select deleted_at is not null and weight_kg = 71
    from public.weight_records
    where id = '11111111-1111-4111-8111-111111111111'
  ),
  'anon left the stored weight unchanged'
);

select * from finish();
rollback;
