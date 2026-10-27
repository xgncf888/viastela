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

create or replace function tests.public_user_rows(target uuid)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  rec record;
  found bigint;
  total bigint := 0;
begin
  for rec in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped
    where n.nspname = 'public'
      and c.relkind = 'r'
  loop
    execute format('select count(*) from public.%I where user_id = $1', rec.table_name)
      into found
      using target;
    total := total + coalesce(found, 0);
  end loop;
  return total;
end;
$$;

select plan(47);

do $$
declare
  user_a uuid;
  user_b uuid;
begin
  user_a := tests.create_supabase_user('train_a', 'train-a@viastela.test');
  user_b := tests.create_supabase_user('train_b', 'train-b@viastela.test');
  perform set_config('tests.user_a', user_a::text, true);
  perform set_config('tests.user_b', user_b::text, true);
end $$;

select ok(
  (select relrowsecurity from pg_class where oid = 'public.training_sets'::regclass),
  'RLS is enabled on training_sets'
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
set local role authenticated;
select is(auth.uid()::text, current_setting('tests.user_a'), 'auth.uid() is user A');

select lives_ok(
  $$
    insert into public.training_sets (id, exercise, reps, weight_kg, recorded_at, tz, local_day)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      '卧推',
      8,
      40,
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
  $$,
  'user A can insert a weighted training set'
);

select lives_ok(
  $$
    insert into public.training_sets (id, exercise, reps, band_level, recorded_at, tz, local_day)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      '引体向上',
      6,
      'light',
      timestamptz '2026-10-23 20:05:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
  $$,
  'user A can insert a band training set'
);

select throws_ok(
  $$
    insert into public.training_sets (id, exercise, reps, band_level, recorded_at, tz, local_day)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      '引体向上',
      6,
      '红',
      timestamptz '2026-10-23 20:05:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
  $$,
  '23514',
  NULL::text,
  'a band level outside light medium heavy extra_heavy is rejected'
);

select is(
  (select count(*) from public.training_sets),
  2::bigint,
  'user A can read their own training sets'
);

select throws_ok(
  $$
    insert into public.training_sets (id, exercise, reps, recorded_at, tz, local_day)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      '深蹲',
      5,
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
  $$,
  '23514',
  NULL::text,
  'a set with neither weight nor band level is rejected'
);

select throws_ok(
  $$
    insert into public.training_sets (id, exercise, reps, weight_kg, band_level, recorded_at, tz, local_day)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      '深蹲',
      5,
      20,
      'light',
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
  $$,
  '23514',
  NULL::text,
  'a set with both weight and band level is rejected'
);

select throws_ok(
  $$
    insert into public.training_sets (id, exercise, reps, weight_kg, recorded_at, tz, local_day)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      '深蹲',
      0,
      20,
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
  $$,
  '23514',
  NULL::text,
  'zero reps are rejected'
);

select lives_ok(
  $$
    insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      70.50,
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
  $$,
  'user A can insert a weight record'
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
set local role authenticated;
select is(auth.uid()::text, current_setting('tests.user_b'), 'auth.uid() is user B');

select is(
  (select count(*) from public.training_sets),
  0::bigint,
  'user B cannot read user A training sets'
);

select lives_ok(
  $$
    do $body$
    declare
      affected integer;
    begin
      update public.training_sets
      set deleted_at = now()
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
      get diagnostics affected = row_count;
      if affected is distinct from 0 then
        raise exception 'updated % rows, expected 0', affected;
      end if;
    end
    $body$;
  $$,
  'user B cannot soft-delete user A training set'
);

select lives_ok(
  $$
    do $body$
    declare
      affected integer;
    begin
      update public.weight_records
      set deleted_at = now()
      where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
      get diagnostics affected = row_count;
      if affected is distinct from 0 then
        raise exception 'updated % rows, expected 0', affected;
      end if;
    end
    $body$;
  $$,
  'user B cannot soft-delete user A weight record'
);

select throws_ok(
  $$
    insert into public.training_sets (id, exercise, reps, weight_kg, recorded_at, tz, local_day)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      '卧推',
      9,
      50,
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
    on conflict (id) do update set reps = excluded.reps
  $$,
  '42501',
  NULL::text,
  'user B cannot upsert user A training id'
);

select throws_ok(
  $$delete from public.training_sets where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'$$,
  '42501',
  NULL::text,
  'user B cannot hard-delete user A training set'
);

reset role;

select ok(
  (
    select deleted_at is null
    from public.training_sets
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ),
  'user A training set is still live after user B updates'
);

select ok(
  (
    select deleted_at is null
    from public.weight_records
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
  ),
  'user A weight is still live after user B updates'
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
set local role authenticated;

select lives_ok(
  $$
    do $body$
    declare
      affected integer;
    begin
      update public.training_sets
      set deleted_at = now()
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
      get diagnostics affected = row_count;
      if affected is distinct from 1 then
        raise exception 'updated % rows, expected 1', affected;
      end if;
    end
    $body$;
  $$,
  'user A can soft-delete their own training set'
);

select is(
  (select count(*) from public.training_sets where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' and deleted_at is not null),
  1::bigint,
  'user A can see their own deleted training set'
);

select throws_ok(
  $$
    update public.training_sets
    set reps = 7
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  $$,
  'P0001',
  'record deleted',
  'update of a deleted training set errors with record deleted'
);

select throws_ok(
  $$
    update public.training_sets
    set tz = 'Not/AZone'
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  $$,
  'P0001',
  'record deleted',
  'updating a deleted training set with an invalid tz raises record deleted'
);

select throws_ok(
  $$
    insert into public.training_sets (id, exercise, reps, weight_kg, recorded_at, tz, local_day)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      '卧推',
      8,
      40,
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
    on conflict (id) do update set reps = excluded.reps
  $$,
  'P0001',
  'record deleted',
  'upsert of a deleted training set errors with record deleted'
);

select throws_ok(
  $$delete from public.training_sets where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'$$,
  '42501',
  NULL::text,
  'user A cannot hard-delete their own training set'
);

select lives_ok(
  $$
    do $body$
    declare
      affected integer;
    begin
      update public.weight_records
      set deleted_at = now()
      where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
      get diagnostics affected = row_count;
      if affected is distinct from 1 then
        raise exception 'updated % rows, expected 1', affected;
      end if;
    end
    $body$;
  $$,
  'user A can soft-delete their own weight record with a plain update'
);

select is(
  (select count(*) from public.weight_records where deleted_at is not null),
  1::bigint,
  'user A can see their own deleted weight record'
);

select throws_ok(
  $$
    update public.weight_records
    set weight_kg = 71
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
  $$,
  'P0001',
  'record deleted',
  'update of a deleted weight record errors with record deleted'
);

select throws_ok(
  $$
    update public.weight_records
    set tz = 'Not/AZone'
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
  $$,
  'P0001',
  'record deleted',
  'updating a deleted weight record with an invalid tz raises record deleted'
);

select throws_ok(
  $$
    insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      71,
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
    on conflict (id) do update set weight_kg = excluded.weight_kg
  $$,
  'P0001',
  'record deleted',
  'upsert of a deleted weight record errors with record deleted'
);

reset role;

select is(
  coalesce((
    select string_agg(c.relname, ',' order by c.relname)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'deleted_at' and not a.attisdropped
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not exists (
        select 1
        from pg_trigger t
        join pg_proc p on p.oid = t.tgfoid
        where t.tgrelid = c.oid
          and not t.tgisinternal
          and p.proname = 'forbid_update_deleted'
      )
  ), ''),
  '',
  'every table with deleted_at has forbid_update_deleted'
);

select ok(
  coalesce((
    select qual is not null and position('deleted_at' in qual) = 0
    from pg_policies
    where schemaname = 'public' and tablename = 'weight_records' and policyname = 'weight_select'
  ), false),
  'weight select policy filters only the owner'
);

select ok(
  coalesce((
    select with_check is not null and position('deleted_at' in with_check) = 0
    from pg_policies
    where schemaname = 'public' and tablename = 'weight_records' and policyname = 'weight_update'
  ), false),
  'weight update check does not reject deleted_at'
);

select ok(
  coalesce((
    select qual is not null and position('deleted_at' in qual) = 0
    from pg_policies
    where schemaname = 'public' and tablename = 'training_sets' and policyname = 'training_select'
  ), false),
  'training select policy filters only the owner'
);

select ok(
  coalesce((
    select with_check is not null and position('deleted_at' in with_check) = 0
    from pg_policies
    where schemaname = 'public' and tablename = 'training_sets' and policyname = 'training_update'
  ), false),
  'training update check does not reject deleted_at'
);

select is(
  (
    select confdeltype::text
    from pg_constraint
    where conrelid = 'public.training_sets'::regclass
      and contype = 'f'
      and conname = 'training_sets_user_id_fkey'
  ),
  'c',
  'training_sets.user_id cascades when the auth user is deleted'
);

select ok(
  tests.public_user_rows(current_setting('tests.user_a')::uuid) > 0,
  'user A still has public rows before the account is deleted'
);

select lives_ok(
  $$delete from auth.users where id = current_setting('tests.user_a')::uuid$$,
  'deleting the auth user is allowed'
);

select is(
  tests.public_user_rows(current_setting('tests.user_a')::uuid),
  0::bigint,
  'deleting a user leaves no public user_id rows'
);

select is(
  (select count(*) from public.training_sets where user_id = current_setting('tests.user_a')::uuid),
  0::bigint,
  'training_sets are included when the user is deleted'
);

select is(
  set_config('request.jwt.claims', '', true),
  '',
  'anon jwt claims are cleared'
);
set local role anon;

select throws_ok($$select count(*) from public.training_sets$$, '42501', NULL::text, 'anon cannot select training sets');
select throws_ok(
  $$
    insert into public.training_sets (id, exercise, reps, weight_kg, recorded_at, tz, local_day)
    values (
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      '卧推',
      8,
      40,
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
  $$,
  '42501',
  NULL::text,
  'anon cannot insert training sets'
);
select throws_ok(
  $$update public.training_sets set reps = 1 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'$$,
  '42501',
  NULL::text,
  'anon cannot update training sets'
);
select throws_ok(
  $$delete from public.training_sets where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'$$,
  '42501',
  NULL::text,
  'anon cannot delete training sets'
);

select * from finish();
rollback;
