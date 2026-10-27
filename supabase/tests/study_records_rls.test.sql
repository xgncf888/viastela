-- Role changes happen in this script with `set local role`.
-- Postgres rejects SET ROLE inside a security-definer function, so there is no helper that switches role.
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

select plan(45);

do $$
declare
  user_a uuid;
  user_b uuid;
begin
  user_a := tests.create_supabase_user('study_a', 'study-a@viastela.test');
  user_b := tests.create_supabase_user('study_b', 'study-b@viastela.test');
  perform set_config('tests.user_a', user_a::text, true);
  perform set_config('tests.user_b', user_b::text, true);
end $$;

select ok(
  (select relrowsecurity from pg_class where oid = 'public.study_records'::regclass),
  'RLS is enabled on study_records'
);

select is(
  set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('tests.user_b'), 'role', 'authenticated')::text,
    true
  ),
  json_build_object('sub', current_setting('tests.user_b'), 'role', 'authenticated')::text,
  'jwt claims identify user B'
);
set local role authenticated;
select is(auth.uid()::text, current_setting('tests.user_b'), 'auth.uid() is user B');

select lives_ok(
  $$
    insert into public.training_sets (id, exercise, reps, weight_kg, recorded_at, tz, local_day)
    values (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
      '深蹲',
      8,
      60,
      timestamptz '2026-10-27 08:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  'user B can insert a training set'
);

select lives_ok(
  $$
    insert into public.study_records (id, topic, duration_minutes, recorded_at, tz, local_day)
    values (
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
      'AI Infra',
      30,
      timestamptz '2026-10-27 08:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  'user B can insert a study record'
);

select throws_ok(
  $$
    insert into public.study_records (id, topic, duration_minutes, recorded_at, tz, local_day)
    values (
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
      '英语',
      0,
      timestamptz '2026-10-27 08:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  '23514',
  NULL::text,
  'a study duration of zero is rejected'
);

select throws_ok(
  $$
    insert into public.study_records (id, topic, duration_minutes, recorded_at, tz, local_day)
    values (
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
      '   ',
      30,
      timestamptz '2026-10-27 08:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  '23514',
  NULL::text,
  'a blank study topic is rejected'
);

select is(
  (select count(*) from public.study_records),
  1::bigint,
  'user B can read their own study record'
);

select lives_ok(
  $$
    do $body$
    declare
      affected integer;
    begin
      update public.training_sets
      set user_id = current_setting('tests.user_a')::uuid
      where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
      get diagnostics affected = row_count;
      if affected is distinct from 1 then
        raise exception 'updated % rows, expected 1', affected;
      end if;
    end
    $body$;
  $$,
  'user B can update user_id on their training set'
);

select lives_ok(
  $$
    do $body$
    declare
      affected integer;
    begin
      update public.study_records
      set user_id = current_setting('tests.user_a')::uuid
      where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
      get diagnostics affected = row_count;
      if affected is distinct from 1 then
        raise exception 'updated % rows, expected 1', affected;
      end if;
    end
    $body$;
  $$,
  'user B can update user_id on their study record'
);

select is(
  (select user_id::text from public.training_sets where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),
  current_setting('tests.user_b'),
  'training set user_id stays user B'
);

select is(
  (select user_id::text from public.study_records where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'),
  current_setting('tests.user_b'),
  'study record user_id stays user B'
);

reset role;
select is(
  set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('tests.user_a'), 'role', 'authenticated')::text,
    true
  ),
  json_build_object('sub', current_setting('tests.user_a'), 'role', 'authenticated')::text,
  'jwt claims identify user A'
);
set local role authenticated;
select is(auth.uid()::text, current_setting('tests.user_a'), 'auth.uid() is user A');

select is(
  (select count(*) from public.training_sets where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),
  0::bigint,
  'user A cannot see the training set after the ignored user_id change'
);

select is(
  (select count(*) from public.study_records where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'),
  0::bigint,
  'user A cannot see the study record after the ignored user_id change'
);

reset role;
select is(set_config('request.jwt.claims', '', true), '', 'postgres jwt claims are cleared');
select is(set_config('request.jwt.claim.sub', '', true), '', 'postgres jwt sub is cleared');
set local role postgres;
select is(current_user, 'postgres', 'the update runs as postgres');
select ok(auth.uid() is null, 'auth.uid() is null without a jwt');

select lives_ok(
  $$
    do $body$
    declare
      affected integer;
    begin
      update public.training_sets
      set user_id = current_setting('tests.user_a')::uuid,
          reps = 11
      where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1';
      get diagnostics affected = row_count;
      if affected is distinct from 1 then
        raise exception 'updated % rows, expected 1', affected;
      end if;
    end
    $body$;
  $$,
  'postgres with no jwt can update a live training set without 42501'
);

select lives_ok(
  $$
    do $body$
    declare
      affected integer;
    begin
      update public.study_records
      set user_id = current_setting('tests.user_a')::uuid,
          duration_minutes = 45
      where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
      get diagnostics affected = row_count;
      if affected is distinct from 1 then
        raise exception 'updated % rows, expected 1', affected;
      end if;
    end
    $body$;
  $$,
  'postgres with no jwt can update a live study record without 42501'
);

select is(
  (select reps from public.training_sets where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),
  11,
  'postgres update changed the training reps'
);

select is(
  (select user_id::text from public.training_sets where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),
  current_setting('tests.user_b'),
  'postgres update still keeps the training user_id'
);

select is(
  (select duration_minutes from public.study_records where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'),
  45,
  'postgres update changed the study duration'
);

select is(
  (select user_id::text from public.study_records where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'),
  current_setting('tests.user_b'),
  'postgres update still keeps the study user_id'
);

select throws_ok(
  $$
    insert into public.training_sets (id, exercise, reps, weight_kg, recorded_at, tz, local_day)
    values (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
      '卧推',
      8,
      40,
      timestamptz '2026-10-27 08:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  '42501',
  'not authenticated',
  'postgres with no jwt cannot insert a training set'
);

select throws_ok(
  $$
    insert into public.study_records (id, topic, duration_minutes, recorded_at, tz, local_day)
    values (
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
      '英语',
      15,
      timestamptz '2026-10-27 08:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  '42501',
  'not authenticated',
  'postgres with no jwt cannot insert a study record'
);

select is(
  set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('tests.user_b'), 'role', 'authenticated')::text,
    true
  ),
  json_build_object('sub', current_setting('tests.user_b'), 'role', 'authenticated')::text,
  'jwt claims identify user B again'
);
set local role authenticated;

select lives_ok(
  $$
    do $body$
    declare
      affected integer;
    begin
      update public.study_records
      set deleted_at = now()
      where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
      get diagnostics affected = row_count;
      if affected is distinct from 1 then
        raise exception 'updated % rows, expected 1', affected;
      end if;
    end
    $body$;
  $$,
  'user B can soft-delete their own study record'
);

select throws_ok(
  $$
    update public.study_records
    set duration_minutes = 20
    where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
  $$,
  'P0001',
  'record deleted',
  'update of a deleted study record errors with record deleted'
);

select throws_ok(
  $$
    update public.study_records
    set tz = 'Not/AZone'
    where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
  $$,
  'P0001',
  'record deleted',
  'updating a deleted study record with an invalid tz raises record deleted'
);

select throws_ok(
  $$
    insert into public.study_records (id, topic, duration_minutes, recorded_at, tz, local_day)
    values (
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
      'AI Infra',
      30,
      timestamptz '2026-10-27 08:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
    on conflict (id) do update set duration_minutes = excluded.duration_minutes
  $$,
  'P0001',
  'record deleted',
  'upsert of a deleted study record errors with record deleted'
);

select throws_ok(
  $$delete from public.study_records where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'$$,
  '42501',
  NULL::text,
  'user B cannot hard-delete their own study record'
);

reset role;
set local role postgres;

select ok(
  has_table_privilege('authenticated', 'public.study_records', 'SELECT')
  and has_table_privilege('authenticated', 'public.study_records', 'INSERT')
  and has_table_privilege('authenticated', 'public.study_records', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.study_records', 'DELETE')
  and not has_table_privilege('authenticated', 'public.study_records', 'TRUNCATE')
  and not has_table_privilege('authenticated', 'public.study_records', 'REFERENCES')
  and not has_table_privilege('authenticated', 'public.study_records', 'TRIGGER'),
  'study_records grants authenticated only select, insert, and update'
);

select ok(
  has_table_privilege('authenticated', 'public.training_sets', 'SELECT')
  and has_table_privilege('authenticated', 'public.training_sets', 'INSERT')
  and has_table_privilege('authenticated', 'public.training_sets', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.training_sets', 'DELETE')
  and not has_table_privilege('authenticated', 'public.training_sets', 'TRUNCATE')
  and not has_table_privilege('authenticated', 'public.training_sets', 'REFERENCES')
  and not has_table_privilege('authenticated', 'public.training_sets', 'TRIGGER'),
  'training_sets grants authenticated only select, insert, and update'
);

select ok(
  coalesce((
    select qual is not null and position('deleted_at' in qual) = 0
    from pg_policies
    where schemaname = 'public' and tablename = 'study_records' and policyname = 'study_select'
  ), false),
  'study select policy filters only the owner'
);

select ok(
  coalesce((
    select with_check is not null and position('deleted_at' in with_check) = 0
    from pg_policies
    where schemaname = 'public' and tablename = 'study_records' and policyname = 'study_update'
  ), false),
  'study update check does not reject deleted_at'
);

select lives_ok(
  $$delete from auth.users where id = current_setting('tests.user_b')::uuid$$,
  'deleting the auth user is allowed'
);

select is(
  (select count(*) from public.study_records where user_id = current_setting('tests.user_b')::uuid),
  0::bigint,
  'study_records are included when the user is deleted'
);

select is(set_config('request.jwt.claims', '', true), '', 'anon jwt claims are cleared');
set local role anon;

select throws_ok($$select count(*) from public.study_records$$, '42501', NULL::text, 'anon cannot select study records');
select throws_ok(
  $$
    insert into public.study_records (id, topic, duration_minutes, recorded_at, tz, local_day)
    values (
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd4',
      '英语',
      15,
      timestamptz '2026-10-27 08:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  '42501',
  NULL::text,
  'anon cannot insert study records'
);
select throws_ok(
  $$update public.study_records set duration_minutes = 1 where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'$$,
  '42501',
  NULL::text,
  'anon cannot update study records'
);
select throws_ok(
  $$delete from public.study_records where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'$$,
  '42501',
  NULL::text,
  'anon cannot delete study records'
);

select * from finish();
rollback;
