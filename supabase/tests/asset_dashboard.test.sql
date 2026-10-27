-- Asset dashboard RLS, checks, events, and grants.
-- Account deletion of these tables is asserted in account_delete.test.sql.
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

-- Runs as the caller. A select that is allowed raises; 42501 is swallowed.
create or replace function tests.deny_all(statements text[])
returns bigint
language plpgsql
set search_path = public, pg_temp
as $$
declare
  statement text;
  seen bigint := 0;
  ignored bigint;
begin
  foreach statement in array statements loop
    seen := seen + 1;
    begin
      if statement ~* '^[[:space:]]*select' then
        execute statement into ignored;
      else
        execute statement;
      end if;
      raise exception 'statement was allowed: %', statement;
    exception
      when insufficient_privilege then
        null;
    end;
  end loop;
  return seen;
end;
$$;

grant usage on schema tests to anon, authenticated;
grant execute on function tests.deny_all(text[]) to anon, authenticated;

select plan(107);

do $$
declare
  user_a uuid;
  user_b uuid;
begin
  user_a := tests.create_supabase_user('asset_a', 'asset-a@viastela.test');
  user_b := tests.create_supabase_user('asset_b', 'asset-b@viastela.test');
  perform set_config('tests.user_a', user_a::text, true);
  perform set_config('tests.user_b', user_b::text, true);
end $$;

do $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('tests.user_a'), 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', current_setting('tests.user_a'), true);
end $$;
set local role authenticated;

select is(auth.uid()::text, current_setting('tests.user_a'), 'auth.uid() is user A');

-- Gate 3: check failures that do not need a parent row.
select throws_ok(
  $$
    insert into public.asset_accounts (id, name, currency)
    values ('f1111111-1111-4111-8111-111111111111', 'Cash', 'EUR')
  $$,
  '23514',
  NULL::text,
  'a currency outside USD CNY SGD HKD is rejected'
);

select throws_ok(
  $$
    insert into public.asset_accounts (id, name, currency)
    values ('f1111111-1111-4111-8111-111111111111', '   ', 'USD')
  $$,
  '23514',
  NULL::text,
  'a blank account name is rejected'
);

select throws_ok(
  $$
    insert into public.asset_accounts (id, name, currency)
    values ('f1111111-1111-4111-8111-111111111111', repeat('A', 41), 'USD')
  $$,
  '23514',
  NULL::text,
  'an account name longer than 40 characters is rejected'
);

select lives_ok(
  $$
    insert into public.asset_accounts (id, name, currency)
    values ('a1111111-1111-4111-8111-111111111111', 'Cash', 'USD')
  $$,
  'user A can insert a USD account'
);

select lives_ok(
  $$
    insert into public.asset_accounts (id, name, currency)
    values ('a2222222-2222-4222-8222-222222222222', 'Bank', 'CNY')
  $$,
  'user A can insert a CNY account'
);

select throws_ok(
  $$
    insert into public.holdings (id, account_id, symbol, quantity)
    values (
      'f2222222-2222-4222-8222-222222222222',
      'a1111111-1111-4111-8111-111111111111',
      'zz',
      1
    )
  $$,
  '23514',
  NULL::text,
  'a lowercase symbol is rejected'
);

select throws_ok(
  $$
    insert into public.holdings (id, account_id, symbol, quantity)
    values (
      'f2222222-2222-4222-8222-222222222222',
      'a1111111-1111-4111-8111-111111111111',
      'ABCDEFGHIJK',
      1
    )
  $$,
  '23514',
  NULL::text,
  'a symbol longer than 10 characters is rejected'
);

select throws_ok(
  $$
    insert into public.holdings (id, account_id, symbol, quantity)
    values (
      'f2222222-2222-4222-8222-222222222222',
      'a1111111-1111-4111-8111-111111111111',
      'ZZ',
      0
    )
  $$,
  '23514',
  NULL::text,
  'a holding quantity of zero is rejected'
);

select throws_ok(
  $$
    insert into public.holdings (id, account_id, symbol, quantity, cost_basis_usd)
    values (
      'f2222222-2222-4222-8222-222222222222',
      'a1111111-1111-4111-8111-111111111111',
      'ZZ',
      -1,
      10
    )
  $$,
  '23514',
  NULL::text,
  'a negative holding quantity is rejected'
);

select throws_ok(
  $$
    insert into public.account_balances (id, account_id, amount, usd_rate, recorded_at, tz, local_day)
    values (
      'f3333333-3333-4333-8333-333333333333',
      'a2222222-2222-4222-8222-222222222222',
      10,
      0,
      timestamptz '2026-10-27 08:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  '23514',
  NULL::text,
  'a usd rate of zero is rejected'
);

select throws_ok(
  $$
    insert into public.net_worth_goals (id, target_usd)
    values ('f4444444-4444-4444-8444-444444444444', 0)
  $$,
  '23514',
  NULL::text,
  'a goal target of zero is rejected'
);

select throws_ok(
  $$
    insert into public.projection_assumptions (id, start_usd, start_month, monthly_net_usd)
    values ('f5555555-5555-4555-8555-555555555555', 0, date '2026-10-02', -10)
  $$,
  '23514',
  NULL::text,
  'a projection start month that is not the first day is rejected'
);

select throws_ok(
  $$
    insert into public.projection_assumptions (
      id, start_usd, start_month, monthly_net_usd, monthly_income_usd, monthly_expense_usd
    )
    values ('f5555555-5555-4555-8555-555555555555', 0, date '2026-10-01', -10, 30, 20)
  $$,
  '23514',
  NULL::text,
  'filling both cashflow forms is rejected'
);

select throws_ok(
  $$
    insert into public.projection_assumptions (id, start_usd, start_month, monthly_income_usd)
    values ('f5555555-5555-4555-8555-555555555555', 0, date '2026-10-01', 30)
  $$,
  '23514',
  NULL::text,
  'income without expense is rejected'
);

select throws_ok(
  $$
    insert into public.projection_assumptions (id, start_usd, start_month, monthly_net_usd, return_rates)
    values (
      'f5555555-5555-4555-8555-555555555555',
      0,
      date '2026-10-01',
      -10,
      '{0.03,0.05}'::numeric(6, 4)[]
    )
  $$,
  '23514',
  NULL::text,
  'return rates with fewer than three values are rejected'
);

select throws_ok(
  $$
    insert into public.projection_assumptions (id, start_usd, start_month, monthly_net_usd, return_rates)
    values (
      'f5555555-5555-4555-8555-555555555555',
      0,
      date '2026-10-01',
      -10,
      '{0.60,0.05,0.07}'::numeric(6, 4)[]
    )
  $$,
  '23514',
  NULL::text,
  'a return rate above 0.5 is rejected'
);

select throws_ok(
  $$
    insert into public.projection_assumptions (id, start_usd, start_month, monthly_net_usd, return_rates)
    values (
      'f5555555-5555-4555-8555-555555555555',
      0,
      date '2026-10-01',
      -10,
      array[0.03, null, 0.07]::numeric(6, 4)[]
    )
  $$,
  '23514',
  NULL::text,
  'a null return rate is rejected'
);

select throws_ok(
  $$
    insert into public.projection_assumptions (id, start_usd, start_month, monthly_net_usd, main_rate_index)
    values ('f5555555-5555-4555-8555-555555555555', 0, date '2026-10-01', -10, 0)
  $$,
  '23514',
  NULL::text,
  'a main rate index of zero is rejected'
);

select throws_ok(
  $$
    insert into public.projection_assumptions (id, start_usd, start_month, monthly_net_usd, main_rate_index)
    values ('f5555555-5555-4555-8555-555555555555', 0, date '2026-10-01', -10, 4)
  $$,
  '23514',
  NULL::text,
  'a main rate index of four is rejected'
);

-- Gate 6, plus the rows the later gates read.
select lives_ok(
  $$
    insert into public.account_balances (
      id, account_id, amount, usd_rate, recorded_at, tz, local_day
    )
    values (
      'c1111111-1111-4111-8111-111111111111',
      'a2222222-2222-4222-8222-222222222222',
      12345.6789,
      1,
      timestamptz '2026-10-27 08:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  'user A can insert a balance of 12345.6789'
);

select ok(
  (
    select amount = 12345.6789::numeric
    from public.account_balances
    where id = 'c1111111-1111-4111-8111-111111111111'
  ),
  'amount 12345.6789 is stored exactly'
);

select lives_ok(
  $$
    insert into public.account_balances (id, account_id, amount, recorded_at, tz, local_day)
    values (
      'c2222222-2222-4222-8222-222222222222',
      'a2222222-2222-4222-8222-222222222222',
      -20,
      timestamptz '2026-10-27 08:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  'a negative balance is allowed'
);

select lives_ok(
  $$
    insert into public.holdings (id, account_id, symbol, quantity, cost_basis_usd)
    values (
      'b1111111-1111-4111-8111-111111111111',
      'a1111111-1111-4111-8111-111111111111',
      'ZZ',
      10,
      100
    )
  $$,
  'user A can insert holding ZZ'
);

select lives_ok(
  $$
    insert into public.net_worth_goals (id, target_usd, target_date)
    values ('d1111111-1111-4111-8111-111111111111', 1000, date '2027-01-01')
  $$,
  'user A can insert one goal'
);

select lives_ok(
  $$
    insert into public.projection_assumptions (id, start_usd, start_month, monthly_net_usd)
    values ('e1111111-1111-4111-8111-111111111111', 0, date '2026-10-01', -10)
  $$,
  'user A can insert a projection that uses a negative monthly net'
);

-- Gate 5.
select lives_ok(
  $$
    do $body$
    begin
      insert into public.net_worth_snapshots (local_day, tz, total_usd, cash_usd, securities_usd, as_of)
      values (date '2026-10-27', 'Asia/Singapore', 100, 40, 60, timestamptz '2026-10-27 08:00:00+00')
      on conflict (user_id, local_day) do update
      set tz = excluded.tz,
          total_usd = excluded.total_usd,
          cash_usd = excluded.cash_usd,
          securities_usd = excluded.securities_usd,
          as_of = excluded.as_of;

      insert into public.net_worth_snapshots (local_day, tz, total_usd, cash_usd, securities_usd, as_of)
      values (date '2026-10-27', 'Asia/Singapore', 200, 80, 120, timestamptz '2026-10-27 09:00:00+00')
      on conflict (user_id, local_day) do update
      set tz = excluded.tz,
          total_usd = excluded.total_usd,
          cash_usd = excluded.cash_usd,
          securities_usd = excluded.securities_usd,
          as_of = excluded.as_of;

      insert into public.net_worth_snapshots (local_day, tz, total_usd, cash_usd, securities_usd, as_of)
      values (date '2026-10-27', 'Asia/Singapore', 300, 120, 180, timestamptz '2026-10-27 10:00:00+00')
      on conflict (user_id, local_day) do update
      set tz = excluded.tz,
          total_usd = excluded.total_usd,
          cash_usd = excluded.cash_usd,
          securities_usd = excluded.securities_usd,
          as_of = excluded.as_of;
    end
    $body$;
  $$,
  'the same snapshot key can be upserted three times'
);

select is(
  (select count(*) from public.net_worth_snapshots),
  1::bigint,
  'three snapshot upserts leave one row'
);

select ok(
  (select total_usd = 300 from public.net_worth_snapshots),
  'the third snapshot upsert is the stored total'
);

-- Gate 1: B cannot see A's seven user-owned tables. Gate 3: composite FK.
reset role;

do $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('tests.user_b'), 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', current_setting('tests.user_b'), true);
end $$;
set local role authenticated;

select is(auth.uid()::text, current_setting('tests.user_b'), 'auth.uid() is user B');

select is((select count(*) from public.asset_accounts), 0::bigint, 'user B cannot read user A accounts');
select is((select count(*) from public.account_balances), 0::bigint, 'user B cannot read user A balances');
select is((select count(*) from public.holdings), 0::bigint, 'user B cannot read user A holdings');
select is((select count(*) from public.net_worth_goals), 0::bigint, 'user B cannot read user A goals');
select is(
  (select count(*) from public.projection_assumptions),
  0::bigint,
  'user B cannot read user A projections'
);
select is((select count(*) from public.net_worth_snapshots), 0::bigint, 'user B cannot read user A snapshots');
select is((select count(*) from public.asset_events), 0::bigint, 'user B cannot read user A events');

select throws_ok(
  $$
    insert into public.account_balances (id, account_id, amount, recorded_at, tz, local_day)
    values (
      'c3333333-3333-4333-8333-333333333333',
      'a1111111-1111-4111-8111-111111111111',
      10,
      timestamptz '2026-10-27 08:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  '23503',
  NULL::text,
  'a balance cannot reference another user account'
);

select throws_ok(
  $$
    insert into public.holdings (id, account_id, symbol, quantity)
    values (
      'f6666666-6666-4666-8666-666666666666',
      'a1111111-1111-4111-8111-111111111111',
      'QQ',
      1
    )
  $$,
  '23503',
  NULL::text,
  'a holding cannot reference another user account'
);

reset role;

do $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('tests.user_a'), 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', current_setting('tests.user_a'), true);
end $$;
set local role authenticated;

select is(auth.uid()::text, current_setting('tests.user_a'), 'auth.uid() is user A again');

-- Gate 4: holding and goal events.
select is(
  (select count(*) from public.asset_events where holding_id = 'b1111111-1111-4111-8111-111111111111'),
  1::bigint,
  'inserting a holding writes one event'
);

select ok(
  (
    select kind = 'holding_added'
      and symbol = 'ZZ'
      and goal_id is null
      and before_quantity is null
      and after_quantity = 10
      and before_usd is null
      and after_usd = 100
      and user_id = current_setting('tests.user_a')::uuid
    from public.asset_events
    where holding_id = 'b1111111-1111-4111-8111-111111111111'
  ),
  'holding_added stores the new quantity and cost'
);

select is(
  (select count(*) from public.asset_events where goal_id = 'd1111111-1111-4111-8111-111111111111'),
  1::bigint,
  'inserting a goal writes one event'
);

select ok(
  (
    select kind = 'goal_changed'
      and symbol is null
      and holding_id is null
      and before_quantity is null
      and after_quantity is null
      and before_usd is null
      and after_usd = 1000
      and user_id = current_setting('tests.user_a')::uuid
    from public.asset_events
    where goal_id = 'd1111111-1111-4111-8111-111111111111'
  ),
  'goal_changed on insert stores the new target'
);

select lives_ok(
  $$
    update public.holdings
    set quantity = 12, cost_basis_usd = 150
    where id = 'b1111111-1111-4111-8111-111111111111'
  $$,
  'user A can change holding quantity and cost'
);

select is(
  (
    select count(*)
    from public.asset_events
    where holding_id = 'b1111111-1111-4111-8111-111111111111'
      and kind = 'holding_changed'
  ),
  1::bigint,
  'a quantity and cost change writes one holding_changed event'
);

select ok(
  (
    select before_quantity = 10
      and after_quantity = 12
      and before_usd = 100
      and after_usd = 150
      and symbol = 'ZZ'
      and user_id = current_setting('tests.user_a')::uuid
    from public.asset_events
    where holding_id = 'b1111111-1111-4111-8111-111111111111'
      and kind = 'holding_changed'
  ),
  'holding_changed stores the previous and next quantity and cost'
);

do $$
begin
  perform set_config(
    'tests.zz_events',
    (
      select count(*)::text
      from public.asset_events
      where holding_id = 'b1111111-1111-4111-8111-111111111111'
    ),
    true
  );
end $$;

select lives_ok(
  $$
    update public.holdings
    set updated_at = now()
    where id = 'b1111111-1111-4111-8111-111111111111'
  $$,
  'user A can touch a holding timestamp'
);

select lives_ok(
  $$
    update public.holdings
    set quantity = 12, cost_basis_usd = 150
    where id = 'b1111111-1111-4111-8111-111111111111'
  $$,
  'user A can write the same holding quantity and cost again'
);

select is(
  (select count(*) from public.asset_events where holding_id = 'b1111111-1111-4111-8111-111111111111'),
  current_setting('tests.zz_events')::bigint,
  'a holding update that changes no quantity or cost writes no event'
);

select throws_ok(
  $$
    insert into public.holdings (id, account_id, symbol, quantity, cost_basis_usd)
    values (
      'b2222222-2222-4222-8222-222222222222',
      'a1111111-1111-4111-8111-111111111111',
      'ZZ',
      4,
      40
    )
  $$,
  '23505',
  NULL::text,
  'a second live holding with the same symbol is rejected'
);

select throws_ok(
  $$
    update public.asset_accounts
    set deleted_at = now()
    where id = 'a1111111-1111-4111-8111-111111111111'
  $$,
  'P0001',
  'account has holdings',
  'soft-deleting an account with a live holding is rejected'
);

select ok(
  (
    select deleted_at is null
    from public.asset_accounts
    where id = 'a1111111-1111-4111-8111-111111111111'
  ),
  'the account with a live holding stays live'
);

select lives_ok(
  $$
    update public.net_worth_goals
    set target_usd = 2000
    where id = 'd1111111-1111-4111-8111-111111111111'
  $$,
  'user A can change the goal target'
);

select is(
  (
    select count(*)
    from public.asset_events
    where goal_id = 'd1111111-1111-4111-8111-111111111111'
      and kind = 'goal_changed'
  ),
  2::bigint,
  'changing the goal target writes one more goal_changed event'
);

select ok(
  (
    select before_usd = 1000
      and after_usd = 2000
      and user_id = current_setting('tests.user_a')::uuid
    from public.asset_events
    where goal_id = 'd1111111-1111-4111-8111-111111111111'
      and before_usd = 1000
      and after_usd = 2000
  ),
  'goal_changed stores the previous and next target'
);

select lives_ok(
  $$
    update public.net_worth_goals
    set target_date = date '2028-01-01'
    where id = 'd1111111-1111-4111-8111-111111111111'
  $$,
  'user A can change the goal date'
);

select is(
  (
    select count(*)
    from public.asset_events
    where goal_id = 'd1111111-1111-4111-8111-111111111111'
      and kind = 'goal_changed'
      and before_usd = 2000
      and after_usd = 2000
  ),
  1::bigint,
  'changing only the goal date writes one goal_changed event'
);

do $$
begin
  perform set_config(
    'tests.goal_events',
    (
      select count(*)::text
      from public.asset_events
      where goal_id = 'd1111111-1111-4111-8111-111111111111'
    ),
    true
  );
end $$;

select lives_ok(
  $$
    update public.net_worth_goals
    set target_usd = 2000
    where id = 'd1111111-1111-4111-8111-111111111111'
  $$,
  'user A can write the same goal target again'
);

select is(
  (select count(*) from public.asset_events where goal_id = 'd1111111-1111-4111-8111-111111111111'),
  current_setting('tests.goal_events')::bigint,
  'a goal update that changes no target writes no event'
);

select throws_ok(
  $$
    insert into public.net_worth_goals (id, target_usd)
    values ('d2222222-2222-4222-8222-222222222222', 3000)
  $$,
  '23505',
  NULL::text,
  'a second live goal is rejected'
);

select throws_ok(
  $$
    insert into public.projection_assumptions (id, start_usd, start_month, monthly_net_usd)
    values ('e2222222-2222-4222-8222-222222222222', 100, date '2026-11-01', 10)
  $$,
  '23505',
  NULL::text,
  'a second live projection is rejected'
);

select lives_ok(
  $$
    update public.net_worth_goals
    set deleted_at = now()
    where id = 'd1111111-1111-4111-8111-111111111111'
  $$,
  'user A can soft-delete the goal'
);

select is(
  (select count(*) from public.asset_events where goal_id = 'd1111111-1111-4111-8111-111111111111'),
  current_setting('tests.goal_events')::bigint,
  'soft-deleting a goal writes no event'
);

select lives_ok(
  $$
    insert into public.net_worth_goals (id, target_usd)
    values ('d2222222-2222-4222-8222-222222222222', 3000)
  $$,
  'a goal can be inserted again after the previous one is soft-deleted'
);

select lives_ok(
  $$
    update public.projection_assumptions
    set deleted_at = now()
    where id = 'e1111111-1111-4111-8111-111111111111'
  $$,
  'user A can soft-delete the projection'
);

select lives_ok(
  $$
    insert into public.projection_assumptions (
      id, start_usd, start_month, monthly_income_usd, monthly_expense_usd, return_rates, main_rate_index
    )
    values (
      'e2222222-2222-4222-8222-222222222222',
      100,
      date '2026-11-01',
      30,
      20,
      '{-0.5,0,0.5}'::numeric(6, 4)[],
      3
    )
  $$,
  'income and expense can be inserted after the net projection is soft-deleted'
);

-- Gate 4 continued: postgres update keeps the row owner. Then soft-delete holdings and the account.
select lives_ok(
  $$
    insert into public.holdings (id, account_id, symbol, quantity, cost_basis_usd)
    values (
      'b3333333-3333-4333-8333-333333333333',
      'a1111111-1111-4111-8111-111111111111',
      'Z.Z',
      7,
      70
    )
  $$,
  'user A can insert holding Z.Z'
);

reset role;

do $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
set local role postgres;

select ok(auth.uid() is null, 'postgres has no jwt subject');

select lives_ok(
  $$
    update public.holdings
    set quantity = 8
    where id = 'b3333333-3333-4333-8333-333333333333'
  $$,
  'postgres can update a holding without a jwt'
);

select is(
  (
    select user_id
    from public.asset_events
    where holding_id = 'b3333333-3333-4333-8333-333333333333'
      and kind = 'holding_changed'
  ),
  current_setting('tests.user_a')::uuid,
  'an event written without a jwt keeps the row owner'
);

reset role;

do $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('tests.user_a'), 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', current_setting('tests.user_a'), true);
end $$;
set local role authenticated;

select lives_ok(
  $$
    update public.holdings
    set deleted_at = now()
    where id = 'b1111111-1111-4111-8111-111111111111'
  $$,
  'user A can soft-delete holding ZZ'
);

select is(
  (
    select count(*)
    from public.asset_events
    where holding_id = 'b1111111-1111-4111-8111-111111111111'
      and kind = 'holding_removed'
  ),
  1::bigint,
  'soft-deleting a holding writes one holding_removed event'
);

select ok(
  (
    select symbol = 'ZZ'
      and before_quantity = 12
      and after_quantity is null
      and before_usd = 150
      and after_usd is null
      and user_id = current_setting('tests.user_a')::uuid
    from public.asset_events
    where holding_id = 'b1111111-1111-4111-8111-111111111111'
      and kind = 'holding_removed'
  ),
  'holding_removed stores the pre-delete quantity and cost'
);

select lives_ok(
  $$
    insert into public.holdings (id, account_id, symbol, quantity, cost_basis_usd)
    values (
      'b2222222-2222-4222-8222-222222222222',
      'a1111111-1111-4111-8111-111111111111',
      'ZZ',
      4,
      40
    )
  $$,
  'the same symbol can be inserted after the previous holding is soft-deleted'
);

select throws_ok(
  $$
    update public.holdings
    set quantity = 1
    where id = 'b1111111-1111-4111-8111-111111111111'
  $$,
  'P0001',
  'record deleted',
  'updating a soft-deleted holding raises record deleted'
);

select lives_ok(
  $$
    update public.holdings
    set deleted_at = now()
    where id in (
      'b2222222-2222-4222-8222-222222222222',
      'b3333333-3333-4333-8333-333333333333'
    )
  $$,
  'user A can soft-delete the remaining live holdings'
);

select lives_ok(
  $$
    do $body$
    declare
      affected integer;
    begin
      update public.asset_accounts
      set deleted_at = now()
      where id = 'a1111111-1111-4111-8111-111111111111';
      get diagnostics affected = row_count;
      if affected is distinct from 1 then
        raise exception 'updated % rows, expected 1', affected;
      end if;
    end
    $body$;
  $$,
  'soft-deleting the holdings first lets the account be deleted'
);

select ok(
  (
    select deleted_at is not null
    from public.asset_accounts
    where id = 'a1111111-1111-4111-8111-111111111111'
  ),
  'the account is soft-deleted once its holdings are gone'
);

select throws_ok(
  $$
    insert into public.holdings (id, account_id, symbol, quantity)
    values (
      'f7777777-7777-4777-8777-777777777777',
      'a1111111-1111-4111-8111-111111111111',
      'YY',
      1
    )
  $$,
  'P0001',
  'parent deleted',
  'inserting a holding on a deleted account raises parent deleted'
);

select lives_ok(
  $$
    do $body$
    declare
      affected integer;
    begin
      update public.asset_accounts
      set deleted_at = now()
      where id = 'a2222222-2222-4222-8222-222222222222';
      get diagnostics affected = row_count;
      if affected is distinct from 1 then
        raise exception 'updated % rows, expected 1', affected;
      end if;
    end
    $body$;
  $$,
  'an account that only has balances can be soft-deleted'
);

select throws_ok(
  $$
    update public.account_balances
    set amount = 1
    where id = 'c1111111-1111-4111-8111-111111111111'
  $$,
  'P0001',
  'parent deleted',
  'updating a balance on a deleted account raises parent deleted'
);

select throws_ok(
  $$
    insert into public.account_balances (id, account_id, amount, recorded_at, tz, local_day)
    values (
      'f8888888-8888-4888-8888-888888888888',
      'a2222222-2222-4222-8222-222222222222',
      5,
      timestamptz '2026-10-27 08:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  'P0001',
  'parent deleted',
  'inserting a balance on a deleted account raises parent deleted'
);

select throws_ok(
  $$
    update public.asset_accounts
    set name = 'Later'
    where id = 'a2222222-2222-4222-8222-222222222222'
  $$,
  'P0001',
  'record deleted',
  'updating a soft-deleted account raises record deleted'
);

-- Gate 4: B's own holding change does not add an event for A.
reset role;

do $$
begin
  perform set_config(
    'tests.a_event_count',
    (
      select count(*)::text
      from public.asset_events
      where user_id = current_setting('tests.user_a')::uuid
    ),
    true
  );
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('tests.user_b'), 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', current_setting('tests.user_b'), true);
end $$;
set local role authenticated;

select lives_ok(
  $$
    insert into public.asset_accounts (id, name, currency)
    values ('a3333333-3333-4333-8333-333333333333', 'Other', 'SGD')
  $$,
  'user B can insert an account'
);

select lives_ok(
  $$
    insert into public.holdings (id, account_id, symbol, quantity, cost_basis_usd)
    values (
      'b4444444-4444-4444-8444-444444444444',
      'a3333333-3333-4333-8333-333333333333',
      'QQ',
      3,
      30
    )
  $$,
  'user B can insert a holding'
);

select lives_ok(
  $$
    update public.holdings
    set quantity = 5
    where id = 'b4444444-4444-4444-8444-444444444444'
  $$,
  'user B can change their own holding'
);

reset role;

select is(
  (
    select user_id
    from public.asset_events
    where holding_id = 'b4444444-4444-4444-8444-444444444444'
      and kind = 'holding_changed'
  ),
  current_setting('tests.user_b')::uuid,
  'user B holding change is stored as user B'
);

select is(
  (select count(*) from public.asset_events where user_id = current_setting('tests.user_a')::uuid),
  current_setting('tests.a_event_count')::bigint,
  'user B holding change does not add an event for user A'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'asset_accounts_forbid_delete_with_holdings'
      and tgrelid = 'public.asset_accounts'::regclass
      and not tgisinternal
  ),
  'asset_accounts_forbid_delete_with_holdings is installed'
);

-- Gate 2: allowlist.
reset role;
set local role postgres;

select ok(
  has_table_privilege('authenticated', 'public.asset_accounts', 'SELECT')
  and has_table_privilege('authenticated', 'public.asset_accounts', 'INSERT')
  and has_table_privilege('authenticated', 'public.asset_accounts', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.asset_accounts', 'DELETE')
  and not has_table_privilege('authenticated', 'public.asset_accounts', 'TRUNCATE')
  and not has_table_privilege('authenticated', 'public.asset_accounts', 'REFERENCES')
  and not has_table_privilege('authenticated', 'public.asset_accounts', 'TRIGGER'),
  'asset_accounts grants authenticated only select, insert, and update'
);

select ok(
  has_table_privilege('authenticated', 'public.account_balances', 'SELECT')
  and has_table_privilege('authenticated', 'public.account_balances', 'INSERT')
  and has_table_privilege('authenticated', 'public.account_balances', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.account_balances', 'DELETE')
  and not has_table_privilege('authenticated', 'public.account_balances', 'TRUNCATE')
  and not has_table_privilege('authenticated', 'public.account_balances', 'REFERENCES')
  and not has_table_privilege('authenticated', 'public.account_balances', 'TRIGGER'),
  'account_balances grants authenticated only select, insert, and update'
);

select ok(
  has_table_privilege('authenticated', 'public.holdings', 'SELECT')
  and has_table_privilege('authenticated', 'public.holdings', 'INSERT')
  and has_table_privilege('authenticated', 'public.holdings', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.holdings', 'DELETE')
  and not has_table_privilege('authenticated', 'public.holdings', 'TRUNCATE')
  and not has_table_privilege('authenticated', 'public.holdings', 'REFERENCES')
  and not has_table_privilege('authenticated', 'public.holdings', 'TRIGGER'),
  'holdings grants authenticated only select, insert, and update'
);

select ok(
  has_table_privilege('authenticated', 'public.net_worth_goals', 'SELECT')
  and has_table_privilege('authenticated', 'public.net_worth_goals', 'INSERT')
  and has_table_privilege('authenticated', 'public.net_worth_goals', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.net_worth_goals', 'DELETE')
  and not has_table_privilege('authenticated', 'public.net_worth_goals', 'TRUNCATE')
  and not has_table_privilege('authenticated', 'public.net_worth_goals', 'REFERENCES')
  and not has_table_privilege('authenticated', 'public.net_worth_goals', 'TRIGGER'),
  'net_worth_goals grants authenticated only select, insert, and update'
);

select ok(
  has_table_privilege('authenticated', 'public.projection_assumptions', 'SELECT')
  and has_table_privilege('authenticated', 'public.projection_assumptions', 'INSERT')
  and has_table_privilege('authenticated', 'public.projection_assumptions', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.projection_assumptions', 'DELETE')
  and not has_table_privilege('authenticated', 'public.projection_assumptions', 'TRUNCATE')
  and not has_table_privilege('authenticated', 'public.projection_assumptions', 'REFERENCES')
  and not has_table_privilege('authenticated', 'public.projection_assumptions', 'TRIGGER'),
  'projection_assumptions grants authenticated only select, insert, and update'
);

select ok(
  has_table_privilege('authenticated', 'public.net_worth_snapshots', 'SELECT')
  and has_table_privilege('authenticated', 'public.net_worth_snapshots', 'INSERT')
  and has_table_privilege('authenticated', 'public.net_worth_snapshots', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.net_worth_snapshots', 'DELETE')
  and not has_table_privilege('authenticated', 'public.net_worth_snapshots', 'TRUNCATE')
  and not has_table_privilege('authenticated', 'public.net_worth_snapshots', 'REFERENCES')
  and not has_table_privilege('authenticated', 'public.net_worth_snapshots', 'TRIGGER'),
  'net_worth_snapshots grants authenticated only select, insert, and update'
);

select ok(
  has_table_privilege('authenticated', 'public.asset_events', 'SELECT')
  and not has_table_privilege('authenticated', 'public.asset_events', 'INSERT')
  and not has_table_privilege('authenticated', 'public.asset_events', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.asset_events', 'DELETE')
  and not has_table_privilege('authenticated', 'public.asset_events', 'TRUNCATE')
  and not has_table_privilege('authenticated', 'public.asset_events', 'REFERENCES')
  and not has_table_privilege('authenticated', 'public.asset_events', 'TRIGGER'),
  'asset_events grants authenticated only select'
);

select ok(
  not has_table_privilege('authenticated', 'public.quote_cache', 'SELECT')
  and not has_table_privilege('authenticated', 'public.quote_cache', 'INSERT')
  and not has_table_privilege('authenticated', 'public.quote_cache', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.quote_cache', 'DELETE'),
  'authenticated has no privileges on quote_cache'
);

select ok(
  not has_table_privilege('authenticated', 'public.fx_rates', 'SELECT')
  and not has_table_privilege('authenticated', 'public.fx_rates', 'INSERT')
  and not has_table_privilege('authenticated', 'public.fx_rates', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.fx_rates', 'DELETE'),
  'authenticated has no privileges on fx_rates'
);

select hasnt_function(
  'public',
  'soft_delete_weight_record',
  'soft_delete_weight_record is gone'
);

do $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', current_setting('tests.user_a'), 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.jwt.claim.sub', current_setting('tests.user_a'), true);
end $$;
reset role;
set local role authenticated;

select throws_ok(
  $$
    insert into public.asset_events (user_id, kind)
    values (auth.uid(), 'holding_added')
  $$,
  '42501',
  NULL::text,
  'authenticated cannot insert asset_events'
);

select throws_ok(
  $$update public.asset_events set kind = 'holding_added'$$,
  '42501',
  NULL::text,
  'authenticated cannot update asset_events'
);

select throws_ok(
  $$select public.record_asset_event()$$,
  '42501',
  NULL::text,
  'authenticated cannot call record_asset_event'
);

select throws_ok(
  $$delete from public.asset_accounts where id = 'a2222222-2222-4222-8222-222222222222'$$,
  '42501',
  NULL::text,
  'authenticated cannot hard-delete an account'
);

select is(
  tests.deny_all(array[
    'select count(*) from public.quote_cache',
    'insert into public.quote_cache (symbol, price) values (''ZZ'', 1)',
    'update public.quote_cache set price = price',
    'delete from public.quote_cache',
    'select count(*) from public.fx_rates',
    'insert into public.fx_rates (base, quote, as_of, rate) values (''USD'', ''CNY'', now(), 1)',
    'update public.fx_rates set rate = rate',
    'delete from public.fx_rates'
  ]),
  8::bigint,
  'authenticated cannot read or write the quote and fx caches'
);

reset role;

do $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
set local role anon;

select throws_ok(
  $$select public.record_asset_event()$$,
  '42501',
  NULL::text,
  'anon cannot call record_asset_event'
);

select is(
  tests.deny_all(array[
    'select count(*) from public.asset_accounts',
    'insert into public.asset_accounts (id, name, currency) values (''f9999999-9999-4999-8999-999999999999'', ''X'', ''USD'')',
    'update public.asset_accounts set name = name',
    'delete from public.asset_accounts',
    'select count(*) from public.account_balances',
    'insert into public.account_balances (id, account_id, amount, recorded_at, tz, local_day) values (''f9999999-9999-4999-8999-999999999991'', ''a2222222-2222-4222-8222-222222222222'', 1, now(), ''UTC'', current_date)',
    'update public.account_balances set amount = amount',
    'delete from public.account_balances',
    'select count(*) from public.holdings',
    'insert into public.holdings (id, account_id, symbol, quantity) values (''f9999999-9999-4999-8999-999999999992'', ''a2222222-2222-4222-8222-222222222222'', ''ZZ'', 1)',
    'update public.holdings set quantity = quantity',
    'delete from public.holdings',
    'select count(*) from public.net_worth_goals',
    'insert into public.net_worth_goals (id, target_usd) values (''f9999999-9999-4999-8999-999999999993'', 1)',
    'update public.net_worth_goals set target_usd = target_usd',
    'delete from public.net_worth_goals',
    'select count(*) from public.projection_assumptions',
    'insert into public.projection_assumptions (id, start_usd, start_month, monthly_net_usd) values (''f9999999-9999-4999-8999-999999999994'', 0, date ''2026-10-01'', 1)',
    'update public.projection_assumptions set start_usd = start_usd',
    'delete from public.projection_assumptions',
    'select count(*) from public.net_worth_snapshots',
    'insert into public.net_worth_snapshots (local_day, tz, total_usd, cash_usd, securities_usd, as_of) values (current_date, ''UTC'', 1, 1, 0, now())',
    'update public.net_worth_snapshots set total_usd = total_usd',
    'delete from public.net_worth_snapshots',
    'select count(*) from public.asset_events',
    'insert into public.asset_events (user_id, kind) values (''00000000-0000-0000-0000-000000000000'', ''holding_added'')',
    'update public.asset_events set kind = kind',
    'delete from public.asset_events',
    'select count(*) from public.quote_cache',
    'insert into public.quote_cache (symbol, price) values (''ZZ'', 1)',
    'update public.quote_cache set price = price',
    'delete from public.quote_cache',
    'select count(*) from public.fx_rates',
    'insert into public.fx_rates (base, quote, as_of, rate) values (''USD'', ''CNY'', now(), 1)',
    'update public.fx_rates set rate = rate',
    'delete from public.fx_rates'
  ]),
  36::bigint,
  'anon cannot read or write any of the nine asset tables'
);

select * from finish();
rollback;
