begin;

create schema if not exists tests;

create or replace function tests.create_supabase_user(identifier text, email text)
returns uuid
language plpgsql
security definer
set search_path = auth, public, extensions, pg_temp
as $$
declare
  user_id uuid := gen_random_uuid();
  col record;
  insert_cols text[] := array[
    'id',
    'email',
    'aud',
    'role',
    'instance_id',
    'raw_app_meta_data',
    'raw_user_meta_data',
    'created_at',
    'updated_at',
    'email_confirmed_at'
  ];
  insert_vals text[] := array[
    quote_literal(user_id::text) || '::uuid',
    quote_literal(email),
    quote_literal('authenticated'),
    quote_literal('authenticated'),
    quote_literal('00000000-0000-0000-0000-000000000000') || '::uuid',
    quote_literal('{"provider":"email","providers":["email"]}') || '::jsonb',
    quote_literal(jsonb_build_object('test_identifier', identifier)::text) || '::jsonb',
    'now()',
    'now()',
    'now()'
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

-- Security invoker on purpose. Postgres rejects SET ROLE inside a security-definer function.
create or replace function tests._assume(identifier text)
returns void
language plpgsql
set search_path = auth, public, pg_temp
as $$
declare
  uid uuid;
begin
  select id into uid
  from auth.users
  where raw_user_meta_data ->> 'test_identifier' = identifier;
  if uid is null then
    raise exception 'user % not found', identifier;
  end if;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function tests.visible_count(identifier text)
returns bigint
language plpgsql
set search_path = public, auth, pg_temp
as $$
declare
  n bigint;
begin
  perform tests._assume(identifier);
  select count(*) into n from public.weight_records;
  execute 'reset role';
  return n;
end;
$$;

create or replace function tests.current_uid(identifier text)
returns uuid
language plpgsql
set search_path = public, auth, pg_temp
as $$
declare
  uid uuid;
begin
  perform tests._assume(identifier);
  uid := auth.uid();
  execute 'reset role';
  return uid;
end;
$$;

create or replace function tests.try_insert_weight(identifier text, weight_id uuid, kilos numeric)
returns void
language plpgsql
set search_path = public, auth, pg_temp
as $$
begin
  perform tests._assume(identifier);
  insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
  values (weight_id, kilos, timestamptz '2026-10-23 20:00:00+00', 'Asia/Singapore', date '2026-10-24');
  execute 'reset role';
end;
$$;

create or replace function tests.try_update_weight(identifier text, weight_id uuid, kilos numeric)
returns bigint
language plpgsql
set search_path = public, auth, pg_temp
as $$
declare
  n bigint;
begin
  perform tests._assume(identifier);
  update public.weight_records set weight_kg = kilos where id = weight_id;
  get diagnostics n = row_count;
  execute 'reset role';
  return n;
end;
$$;

create or replace function tests.try_delete_weight(identifier text, weight_id uuid)
returns bigint
language plpgsql
set search_path = public, auth, pg_temp
as $$
declare
  n bigint;
begin
  perform tests._assume(identifier);
  delete from public.weight_records where id = weight_id;
  get diagnostics n = row_count;
  execute 'reset role';
  return n;
end;
$$;

select plan(8);

-- perform keeps these inserts out of the TAP stream.
do $$
begin
  perform tests.create_supabase_user('user_a', 'user-a@viastela.test');
  perform tests.create_supabase_user('user_b', 'user-b@viastela.test');
end $$;

select ok(
  (select relrowsecurity from pg_class where oid = 'public.weight_records'::regclass),
  'RLS is enabled on weight_records'
);

select is(
  tests.current_uid('user_a'),
  (select id from auth.users where raw_user_meta_data ->> 'test_identifier' = 'user_a'),
  'auth.uid() is user A while acting as user A'
);

select lives_ok(
  $$select tests.try_insert_weight('user_a', '11111111-1111-4111-8111-111111111111', 70.50)$$,
  'user A can insert a weight record'
);

select is(
  tests.visible_count('user_a'),
  1::bigint,
  'user A can read their own weight record'
);

select is(
  tests.visible_count('user_b'),
  0::bigint,
  'user B cannot read user A weight records'
);

select is(
  tests.try_update_weight('user_b', '11111111-1111-4111-8111-111111111111', 99),
  0::bigint,
  'user B cannot update user A weight records'
);

select is(
  tests.try_delete_weight('user_b', '11111111-1111-4111-8111-111111111111'),
  0::bigint,
  'user B cannot delete user A weight records'
);

select ok(
  (select weight_kg = 70.50 from public.weight_records where id = '11111111-1111-4111-8111-111111111111'),
  'user A weight is unchanged after user B attempts'
);

select * from finish();
rollback;
