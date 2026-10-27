-- Deleting an auth user must remove every public row keyed by that user_id.
-- Every foreign key on a public user_id column must be ON DELETE CASCADE, so a
-- later table that forgets the cascade fails here even before it has rows.
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

-- confdeltype 'c' is ON DELETE CASCADE.
create or replace function tests.user_id_cascade_fk_count()
returns bigint
language sql
set search_path = pg_catalog
as $$
  select count(*)
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum = any (con.conkey)
  where con.contype = 'f'
    and n.nspname = 'public'
    and a.attname = 'user_id'
    and not a.attisdropped
    and con.confdeltype = 'c';
$$;

create or replace function tests.user_id_fks_without_cascade()
returns text
language sql
set search_path = pg_catalog
as $$
  select coalesce(string_agg(
    format('%I.%I', n.nspname, c.relname),
    ',' order by n.nspname, c.relname, con.conname
  ), '')
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where con.contype = 'f'
    and n.nspname = 'public'
    and con.confdeltype is distinct from 'c'
    and exists (
      select 1
      from pg_attribute a
      where a.attrelid = c.oid
        and a.attnum = any (con.conkey)
        and a.attname = 'user_id'
        and not a.attisdropped
    );
$$;

-- Runs as the test role, which can see rows hidden by RLS, including soft-deleted weights.
create or replace function tests.public_user_id_residue(target uuid)
returns text
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  rec record;
  found bigint;
  parts text[] := array[]::text[];
begin
  for rec in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and a.attname = 'user_id'
      and a.attnum > 0
      and not a.attisdropped
    order by c.relname
  loop
    execute format(
      'select count(*) from %I.%I where user_id = $1',
      rec.schema_name,
      rec.table_name
    )
      into found
      using target;
    if found > 0 then
      parts := parts || format('%s:%s', rec.table_name, found);
    end if;
  end loop;
  return coalesce(array_to_string(parts, ','), '');
end;
$$;

select plan(77);

do $$
declare
  user_a uuid;
  user_b uuid;
begin
  user_a := tests.create_supabase_user('delete_a', 'delete-a@viastela.test');
  user_b := tests.create_supabase_user('delete_b', 'delete-b@viastela.test');
  perform set_config('tests.user_a', user_a::text, true);
  perform set_config('tests.user_b', user_b::text, true);
end $$;

select ok(
  tests.user_id_cascade_fk_count() >= 4,
  'profile, weight, training, and study user_id foreign keys cascade'
);

select is(
  tests.user_id_fks_without_cascade(),
  '',
  'every foreign key on a public user_id column is on delete cascade'
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
  'user A can insert a live weight record'
);

select lives_ok(
  $$
    insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values (
      '22222222-2222-4222-8222-222222222222',
      71.00,
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
  $$,
  'user A can insert a second weight record'
);

select lives_ok(
  $$
    do $body$
    declare
      affected integer;
    begin
      update public.weight_records
      set deleted_at = now()
      where id = '22222222-2222-4222-8222-222222222222';
      get diagnostics affected = row_count;
      if affected is distinct from 1 then
        raise exception 'updated % rows, expected 1', affected;
      end if;
    end
    $body$;
  $$,
  'user A can soft-delete the second weight record'
);

select lives_ok(
  $$
    insert into public.training_sets (id, exercise, reps, weight_kg, recorded_at, tz, local_day)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      '深蹲',
      8,
      60,
      timestamptz '2026-10-27 08:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  'user A can insert a training set'
);

select lives_ok(
  $$
    insert into public.study_records (id, topic, duration_minutes, recorded_at, tz, local_day)
    values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      'AI Infra',
      30,
      timestamptz '2026-10-27 08:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  'user A can insert a study record'
);

select lives_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz)
    values (
      'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e201',
      '100',
      (now() at time zone 'Asia/Singapore')::date,
      'Asia/Singapore'
    )
  $$,
  'user A can insert a journal entry'
);

select lives_ok(
  $$
    insert into public.push_subscriptions (id, endpoint, p256dh, auth, tz)
    values (
      'f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f201',
      'https://push.example.test/1001',
      'k1001',
      's1001',
      'Asia/Singapore'
    )
  $$,
  'user A can insert a push subscription'
);

select lives_ok(
  $$
    insert into public.asset_accounts (id, name, currency)
    values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'Cash', 'USD')
  $$,
  'user A can insert an asset account'
);

select lives_ok(
  $$
    insert into public.account_balances (id, account_id, amount, usd_rate, recorded_at, tz, local_day)
    values (
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      100,
      1,
      timestamptz '2026-10-27 08:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  'user A can insert an account balance'
);

select lives_ok(
  $$
    insert into public.holdings (id, account_id, symbol, quantity, cost_basis_usd)
    values (
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      'ZZ',
      2,
      100
    )
  $$,
  'user A can insert a holding'
);

select lives_ok(
  $$
    insert into public.net_worth_goals (id, target_usd)
    values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc4', 1000)
  $$,
  'user A can insert a net worth goal'
);

select lives_ok(
  $$
    insert into public.projection_assumptions (id, start_usd, start_month, monthly_net_usd)
    values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc5', 100, date '2026-10-01', 10)
  $$,
  'user A can insert a projection'
);

select lives_ok(
  $$
    insert into public.net_worth_snapshots (local_day, tz, total_usd, cash_usd, securities_usd, as_of)
    values (
      date '2026-10-27',
      'Asia/Singapore',
      200,
      100,
      100,
      timestamptz '2026-10-27 08:00:00+00'
    )
  $$,
  'user A can insert a net worth snapshot'
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

select lives_ok(
  $$
    insert into public.weight_records (id, weight_kg, recorded_at, tz, local_day)
    values (
      '33333333-3333-4333-8333-333333333333',
      80.00,
      timestamptz '2026-10-23 20:00:00+00',
      'Asia/Singapore',
      date '2026-10-24'
    )
  $$,
  'user B can insert a weight record'
);

select lives_ok(
  $$
    insert into public.training_sets (id, exercise, reps, weight_kg, recorded_at, tz, local_day)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      '卧推',
      5,
      40,
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
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      '英语',
      15,
      timestamptz '2026-10-27 08:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  'user B can insert a study record'
);

select lives_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz)
    values (
      'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e202',
      '100',
      (now() at time zone 'Asia/Singapore')::date,
      'Asia/Singapore'
    )
  $$,
  'user B can insert a journal entry'
);

select lives_ok(
  $$
    insert into public.push_subscriptions (id, endpoint, p256dh, auth, tz)
    values (
      'f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f202',
      'https://push.example.test/1002',
      'k1002',
      's1002',
      'Asia/Singapore'
    )
  $$,
  'user B can insert a push subscription'
);

select lives_ok(
  $$
    insert into public.asset_accounts (id, name, currency)
    values ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'Cash', 'HKD')
  $$,
  'user B can insert an asset account'
);

select lives_ok(
  $$
    insert into public.account_balances (id, account_id, amount, recorded_at, tz, local_day)
    values (
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
      80,
      timestamptz '2026-10-27 08:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  'user B can insert an account balance'
);

select lives_ok(
  $$
    insert into public.holdings (id, account_id, symbol, quantity, cost_basis_usd)
    values (
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
      'YY',
      3,
      50
    )
  $$,
  'user B can insert a holding'
);

select lives_ok(
  $$
    insert into public.net_worth_goals (id, target_usd)
    values ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4', 2000)
  $$,
  'user B can insert a net worth goal'
);

select lives_ok(
  $$
    insert into public.projection_assumptions (id, start_usd, start_month, monthly_net_usd)
    values ('dddddddd-dddd-4ddd-8ddd-ddddddddddd5', 50, date '2026-10-01', 5)
  $$,
  'user B can insert a projection'
);

select lives_ok(
  $$
    insert into public.net_worth_snapshots (local_day, tz, total_usd, cash_usd, securities_usd, as_of)
    values (
      date '2026-10-27',
      'Asia/Singapore',
      130,
      80,
      50,
      timestamptz '2026-10-27 08:00:00+00'
    )
  $$,
  'user B can insert a net worth snapshot'
);

reset role;

select isnt(
  tests.public_user_id_residue(current_setting('tests.user_a')::uuid),
  '',
  'user A still has public rows before the auth user is deleted'
);

select is(
  (select count(*) from public.weight_records where user_id = current_setting('tests.user_a')::uuid),
  2::bigint,
  'the live weight and the soft-deleted weight both exist before delete'
);

select is(
  (select count(*) from public.profiles where user_id = current_setting('tests.user_a')::uuid),
  1::bigint,
  'user A profile exists before delete'
);

select is(
  (select count(*) from public.training_sets where user_id = current_setting('tests.user_a')::uuid),
  1::bigint,
  'user A training set exists before delete'
);

select is(
  (select count(*) from public.study_records where user_id = current_setting('tests.user_a')::uuid),
  1::bigint,
  'user A study record exists before delete'
);

select is(
  (select count(*) from public.journal_entries where user_id = current_setting('tests.user_a')::uuid),
  1::bigint,
  'user A journal entry exists before delete'
);

select is(
  (select count(*) from public.push_subscriptions where user_id = current_setting('tests.user_a')::uuid),
  1::bigint,
  'user A push subscription exists before delete'
);

select is(
  (select count(*) from public.asset_accounts where user_id = current_setting('tests.user_a')::uuid),
  1::bigint,
  'user A asset account exists before delete'
);

select is(
  (select count(*) from public.account_balances where user_id = current_setting('tests.user_a')::uuid),
  1::bigint,
  'user A account balance exists before delete'
);

select is(
  (select count(*) from public.holdings where user_id = current_setting('tests.user_a')::uuid),
  1::bigint,
  'user A holding exists before delete'
);

select is(
  (select count(*) from public.net_worth_goals where user_id = current_setting('tests.user_a')::uuid),
  1::bigint,
  'user A net worth goal exists before delete'
);

select is(
  (select count(*) from public.projection_assumptions where user_id = current_setting('tests.user_a')::uuid),
  1::bigint,
  'user A projection exists before delete'
);

select is(
  (select count(*) from public.net_worth_snapshots where user_id = current_setting('tests.user_a')::uuid),
  1::bigint,
  'user A net worth snapshot exists before delete'
);

select is(
  (select count(*) from public.asset_events where user_id = current_setting('tests.user_a')::uuid),
  2::bigint,
  'user A asset events exist before delete'
);

select lives_ok(
  $$delete from auth.users where id = current_setting('tests.user_a')::uuid$$,
  'deleting the auth user removes that account'
);

select is(
  tests.public_user_id_residue(current_setting('tests.user_a')::uuid),
  '',
  'no public table with user_id still has a row for the deleted user'
);

select is(
  (select count(*) from public.weight_records where user_id = current_setting('tests.user_a')::uuid),
  0::bigint,
  'deleted user weight rows are gone, including the soft-deleted row'
);

select is(
  (select count(*) from public.profiles where user_id = current_setting('tests.user_a')::uuid),
  0::bigint,
  'deleted user profile is gone'
);

select is(
  (select count(*) from public.training_sets where user_id = current_setting('tests.user_a')::uuid),
  0::bigint,
  'deleted user training rows are gone'
);

select is(
  (select count(*) from public.study_records where user_id = current_setting('tests.user_a')::uuid),
  0::bigint,
  'deleted user study rows are gone'
);

select is(
  (select count(*) from public.journal_entries where user_id = current_setting('tests.user_a')::uuid),
  0::bigint,
  'deleted user journal entries are gone'
);

select is(
  (select count(*) from public.push_subscriptions where user_id = current_setting('tests.user_a')::uuid),
  0::bigint,
  'deleted user push subscriptions are gone'
);

select is(
  (select count(*) from public.asset_accounts where user_id = current_setting('tests.user_a')::uuid),
  0::bigint,
  'deleted user asset accounts are gone'
);

select is(
  (select count(*) from public.account_balances where user_id = current_setting('tests.user_a')::uuid),
  0::bigint,
  'deleted user account balances are gone'
);

select is(
  (select count(*) from public.holdings where user_id = current_setting('tests.user_a')::uuid),
  0::bigint,
  'deleted user holdings are gone'
);

select is(
  (select count(*) from public.net_worth_goals where user_id = current_setting('tests.user_a')::uuid),
  0::bigint,
  'deleted user net worth goals are gone'
);

select is(
  (select count(*) from public.projection_assumptions where user_id = current_setting('tests.user_a')::uuid),
  0::bigint,
  'deleted user projections are gone'
);

select is(
  (select count(*) from public.net_worth_snapshots where user_id = current_setting('tests.user_a')::uuid),
  0::bigint,
  'deleted user net worth snapshots are gone'
);

select is(
  (select count(*) from public.asset_events where user_id = current_setting('tests.user_a')::uuid),
  0::bigint,
  'deleted user asset events are gone'
);

select is(
  (select count(*) from auth.users where id = current_setting('tests.user_a')::uuid),
  0::bigint,
  'deleted auth user row is gone'
);

select isnt(
  tests.public_user_id_residue(current_setting('tests.user_b')::uuid),
  '',
  'the other user still has public rows'
);

select is(
  (select count(*) from public.weight_records where user_id = current_setting('tests.user_b')::uuid),
  1::bigint,
  'the other user weight row remains'
);

select is(
  (select count(*) from public.profiles where user_id = current_setting('tests.user_b')::uuid),
  1::bigint,
  'the other user profile remains'
);

select is(
  (select count(*) from public.training_sets where user_id = current_setting('tests.user_b')::uuid),
  1::bigint,
  'the other user training row remains'
);

select is(
  (select count(*) from public.study_records where user_id = current_setting('tests.user_b')::uuid),
  1::bigint,
  'the other user study row remains'
);

select is(
  (select count(*) from public.journal_entries where user_id = current_setting('tests.user_b')::uuid),
  1::bigint,
  'the other user journal entry remains'
);

select is(
  (select count(*) from public.push_subscriptions where user_id = current_setting('tests.user_b')::uuid),
  1::bigint,
  'the other user push subscription remains'
);

select is(
  (select count(*) from public.asset_accounts where user_id = current_setting('tests.user_b')::uuid),
  1::bigint,
  'the other user asset account remains'
);

select is(
  (select count(*) from public.account_balances where user_id = current_setting('tests.user_b')::uuid),
  1::bigint,
  'the other user account balance remains'
);

select is(
  (select count(*) from public.holdings where user_id = current_setting('tests.user_b')::uuid),
  1::bigint,
  'the other user holding remains'
);

select is(
  (select count(*) from public.net_worth_goals where user_id = current_setting('tests.user_b')::uuid),
  1::bigint,
  'the other user net worth goal remains'
);

select is(
  (select count(*) from public.projection_assumptions where user_id = current_setting('tests.user_b')::uuid),
  1::bigint,
  'the other user projection remains'
);

select is(
  (select count(*) from public.net_worth_snapshots where user_id = current_setting('tests.user_b')::uuid),
  1::bigint,
  'the other user net worth snapshot remains'
);

select is(
  (select count(*) from public.asset_events where user_id = current_setting('tests.user_b')::uuid),
  2::bigint,
  'the other user asset events remain'
);

select is(
  (select count(*) from auth.users where id = current_setting('tests.user_b')::uuid),
  1::bigint,
  'the other auth user remains'
);

select * from finish();
rollback;
