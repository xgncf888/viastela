-- Journal entries, push subscriptions, and the timeline view.
-- Amounts, rates, and quantities below are invented integers.
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

select plan(122);

do $$
declare
  user_a uuid;
  user_b uuid;
begin
  user_a := tests.create_supabase_user('journal_a', 'journal-a@viastela.test');
  user_b := tests.create_supabase_user('journal_b', 'journal-b@viastela.test');
  perform set_config('tests.user_a', user_a::text, true);
  perform set_config('tests.user_b', user_b::text, true);
  perform set_config(
    'tests.today',
    ((now() at time zone 'Asia/Singapore')::date)::text,
    true
  );
end $$;

select ok(
  (select relrowsecurity from pg_class where oid = 'public.journal_entries'::regclass),
  'RLS is enabled on journal_entries'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.push_subscriptions'::regclass),
  'RLS is enabled on push_subscriptions'
);

select ok(
  exists (
    select 1
    from pg_class
    where oid = 'public.timeline'::regclass
      and relkind = 'v'
      and coalesce(reloptions, array[]::text[])
        && array['security_invoker=true', 'security_invoker=on']
  ),
  'timeline runs with security_invoker'
);

select is(
  (
    select string_agg(attname, ',' order by attnum)
    from pg_attribute
    where attrelid = 'public.timeline'::regclass
      and attnum > 0
      and not attisdropped
  ),
  'kind,occurred_at,local_day,ref_id,payload,id',
  'timeline columns are kind, occurred_at, local_day, ref_id, payload, id'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'journal_entries_active_user_day_idx'
      and indexdef ilike '%(user_id, entry_day DESC)%'
      and indexdef ilike '%WHERE (deleted_at IS NULL)%'
  ),
  'live journal entries are indexed by user and entry day'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'push_subscriptions_active_user_endpoint_idx'
      and indexdef ilike 'CREATE UNIQUE INDEX%'
      and indexdef ilike '%(user_id, endpoint)%'
      and indexdef ilike '%WHERE (deleted_at IS NULL)%'
  ),
  'live push subscriptions are unique per user and endpoint'
);

select has_column(
  'public',
  'push_subscriptions',
  'training_enabled',
  'push_subscriptions.training_enabled exists'
);

select col_default_is(
  'public',
  'push_subscriptions',
  'training_enabled',
  'false',
  'training_enabled defaults to false'
);

select has_column(
  'public',
  'push_subscriptions',
  'month_end_enabled',
  'push_subscriptions.month_end_enabled exists'
);

select col_default_is(
  'public',
  'push_subscriptions',
  'month_end_enabled',
  'false',
  'month_end_enabled defaults to false'
);

select hasnt_column(
  'public',
  'push_subscriptions',
  'enabled',
  'push_subscriptions.enabled does not exist'
);

select ok(
  position('fx_rates' in pg_get_viewdef('public.timeline'::regclass, true)) = 0,
  'timeline does not read fx_rates'
);

select ok(
  position('training_sets' in pg_get_viewdef('public.timeline'::regclass, true)) = 0
  and position('study_records' in pg_get_viewdef('public.timeline'::regclass, true)) = 0,
  'training and study stay out of this timeline'
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
    insert into public.journal_entries (id, body, entry_day, tz, mood, tags)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e101',
      '100',
      current_setting('tests.today')::date,
      'Asia/Singapore',
      3,
      array['100']
    )
  $$,
  'user A can insert a journal entry'
);

select lives_ok(
  $$
    insert into public.push_subscriptions (id, endpoint, p256dh, auth, tz)
    values (
      'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f101',
      'https://push.example.test/1101',
      'k1101',
      's1101',
      'Asia/Singapore'
    )
  $$,
  'user A can insert a push subscription'
);

select lives_ok(
  $$
    insert into public.asset_accounts (id, name, currency)
    values ('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a101', 'A101', 'USD')
  $$,
  'user A can insert an account'
);

select lives_ok(
  $$
    insert into public.account_balances (id, account_id, amount, usd_rate, recorded_at, tz, local_day)
    values (
      'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b101',
      'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a101',
      100,
      2,
      timestamptz '2026-10-27 01:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  'user A can insert a balance'
);

select lives_ok(
  $$
    insert into public.holdings (id, account_id, symbol, quantity, cost_basis_usd)
    values (
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c101',
      'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a101',
      'ABC',
      3,
      10
    )
  $$,
  'user A can insert a holding'
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
  (select count(*) from public.journal_entries),
  0::bigint,
  'user B cannot read user A journal entries'
);

select is(
  (select count(*) from public.push_subscriptions),
  0::bigint,
  'user B cannot read user A push subscriptions'
);

select is(
  (select count(*) from public.timeline),
  0::bigint,
  'user B cannot read user A timeline rows'
);

reset role;

select is(set_config('request.jwt.claims', '', true), '', 'anon jwt claims are cleared');
select is(set_config('request.jwt.claim.sub', '', true), '', 'anon jwt sub is cleared');
set local role anon;

select throws_ok(
  $$select count(*) from public.journal_entries$$,
  '42501',
  NULL::text,
  'anon cannot select journal entries'
);
select throws_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e199',
      '100',
      current_setting('tests.today')::date,
      'Asia/Singapore'
    )
  $$,
  '42501',
  NULL::text,
  'anon cannot insert journal entries'
);
select throws_ok(
  $$update public.journal_entries set body = '100' where id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e101'$$,
  '42501',
  NULL::text,
  'anon cannot update journal entries'
);
select throws_ok(
  $$delete from public.journal_entries where id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e101'$$,
  '42501',
  NULL::text,
  'anon cannot delete journal entries'
);
select throws_ok(
  $$select count(*) from public.push_subscriptions$$,
  '42501',
  NULL::text,
  'anon cannot select push subscriptions'
);
select throws_ok(
  $$
    insert into public.push_subscriptions (id, endpoint, p256dh, auth, tz)
    values (
      'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f199',
      'https://push.example.test/1199',
      'k1199',
      's1199',
      'Asia/Singapore'
    )
  $$,
  '42501',
  NULL::text,
  'anon cannot insert push subscriptions'
);
select throws_ok(
  $$update public.push_subscriptions set training_enabled = true where id = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f101'$$,
  '42501',
  NULL::text,
  'anon cannot update push subscriptions'
);
select throws_ok(
  $$delete from public.push_subscriptions where id = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f101'$$,
  '42501',
  NULL::text,
  'anon cannot delete push subscriptions'
);
select throws_ok(
  $$select count(*) from public.reminder_deliveries$$,
  '42501',
  NULL::text,
  'anon cannot select reminder deliveries'
);
select throws_ok(
  $$
    insert into public.reminder_deliveries (subscription_id, kind, local_day)
    values ('f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f101', 'training', date '2026-10-27')
  $$,
  '42501',
  NULL::text,
  'anon cannot insert reminder deliveries'
);
select throws_ok(
  $$select count(*) from public.timeline$$,
  '42501',
  NULL::text,
  'anon cannot select the timeline'
);
select throws_ok(
  $$insert into public.timeline (kind) values ('journal')$$,
  '42501',
  NULL::text,
  'anon cannot write the timeline'
);

reset role;

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

select throws_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e111',
      '   ',
      current_setting('tests.today')::date,
      'Asia/Singapore'
    )
  $$,
  '23514',
  NULL::text,
  'a blank journal body is rejected'
);

select throws_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e112',
      repeat('a', 2001),
      current_setting('tests.today')::date,
      'Asia/Singapore'
    )
  $$,
  '23514',
  NULL::text,
  'a journal body of 2001 characters is rejected'
);

select lives_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e113',
      repeat('a', 2000),
      current_setting('tests.today')::date,
      'Asia/Singapore'
    )
  $$,
  'a journal body of 2000 characters is accepted'
);

select lives_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e114',
      '  a  ',
      current_setting('tests.today')::date,
      'Asia/Singapore'
    )
  $$,
  'journal body length is measured after trimming the ends'
);

select throws_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz, mood)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e115',
      '100',
      current_setting('tests.today')::date,
      'Asia/Singapore',
      0
    )
  $$,
  '23514',
  NULL::text,
  'mood 0 is rejected'
);

select throws_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz, mood)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e116',
      '100',
      current_setting('tests.today')::date,
      'Asia/Singapore',
      6
    )
  $$,
  '23514',
  NULL::text,
  'mood 6 is rejected'
);

select lives_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz, mood)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e117',
      '100',
      current_setting('tests.today')::date,
      'Asia/Singapore',
      1
    )
  $$,
  'mood 1 is accepted'
);

select lives_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz, mood)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e118',
      '100',
      current_setting('tests.today')::date,
      'Asia/Singapore',
      5
    )
  $$,
  'mood 5 is accepted'
);

select lives_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz, mood)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e119',
      '100',
      current_setting('tests.today')::date,
      'Asia/Singapore',
      null
    )
  $$,
  'a null mood is accepted'
);

select throws_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz, tags)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e120',
      '100',
      current_setting('tests.today')::date,
      'Asia/Singapore',
      array['1', '2', '3', '4', '5', '6']
    )
  $$,
  '23514',
  NULL::text,
  'six journal tags are rejected'
);

select throws_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz, tags)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e121',
      '100',
      current_setting('tests.today')::date,
      'Asia/Singapore',
      array[repeat('a', 21)]
    )
  $$,
  '23514',
  NULL::text,
  'a journal tag of 21 characters is rejected'
);

select throws_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz, tags)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e122',
      '100',
      current_setting('tests.today')::date,
      'Asia/Singapore',
      array['']
    )
  $$,
  '23514',
  NULL::text,
  'an empty journal tag is rejected'
);

select throws_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz, tags)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e123',
      '100',
      current_setting('tests.today')::date,
      'Asia/Singapore',
      array['100', null]::text[]
    )
  $$,
  '23514',
  NULL::text,
  'a null journal tag is rejected'
);

select lives_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz, tags)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e124',
      '100',
      current_setting('tests.today')::date,
      'Asia/Singapore',
      array[
        repeat('a', 20),
        repeat('b', 20),
        repeat('c', 20),
        repeat('d', 20),
        repeat('e', 20)
      ]
    )
  $$,
  'five journal tags of 20 characters are accepted'
);

select throws_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e125',
      '100',
      current_setting('tests.today')::date + 1,
      'Asia/Singapore'
    )
  $$,
  '23514',
  NULL::text,
  'an entry day after the local today is rejected'
);

select lives_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e126',
      '100',
      current_setting('tests.today')::date,
      'Asia/Singapore'
    )
  $$,
  'an entry day of the local today is accepted'
);

select lives_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e127',
      '100',
      current_setting('tests.today')::date - 1,
      'Asia/Singapore'
    )
  $$,
  'an entry day before the local today is accepted'
);

select lives_ok(
  $$
    insert into public.journal_entries (id, body, entry_day, tz)
    values (
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e128',
      '100',
      current_setting('tests.today')::date,
      'Asia/Singapore'
    )
  $$,
  'user A can insert the journal entry that will be soft-deleted'
);

select is(
  (select count(*) from public.timeline where id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e128' and kind = 'journal'),
  1::bigint,
  'a live journal entry appears on the timeline'
);

select lives_ok(
  $$
    update public.journal_entries
    set deleted_at = now()
    where id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e128'
  $$,
  'user A can soft-delete a journal entry'
);

select is(
  (select count(*) from public.timeline where id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e128'),
  0::bigint,
  'a soft-deleted journal entry leaves the timeline'
);

select is(
  (select count(*) from public.journal_entries where id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e128'),
  1::bigint,
  'a soft-deleted journal entry stays in the table'
);

select lives_ok(
  $$
    insert into public.asset_accounts (id, name, currency)
    values ('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a102', 'A102', 'USD')
  $$,
  'user A can insert the balance account'
);

select lives_ok(
  $$
    insert into public.account_balances (id, account_id, amount, usd_rate, recorded_at, tz, local_day)
    values (
      'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b102',
      'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a102',
      100,
      2,
      timestamptz '2026-10-27 01:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  'user A can insert the first balance'
);

select lives_ok(
  $$
    insert into public.account_balances (id, account_id, amount, usd_rate, recorded_at, tz, local_day)
    values (
      'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b103',
      'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a102',
      250,
      2,
      timestamptz '2026-10-27 02:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  'user A can insert the second balance'
);

select is(
  (
    select count(*)
    from public.timeline
    where kind = 'balance_recorded'
      and ref_id = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a102'
  ),
  2::bigint,
  'both live balances appear on the timeline'
);

select ok(
  not (
    select payload ? 'before_amount'
    from public.timeline
    where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b102'
  ),
  'the first balance has no previous amount'
);

select is(
  (
    select (payload ->> 'after_usd')::numeric
    from public.timeline
    where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b102'
  ),
  200::numeric,
  'the first balance USD is amount times usd_rate'
);

select is(
  (
    select (payload ->> 'before_amount')::numeric
    from public.timeline
    where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b103'
  ),
  100::numeric,
  'the second balance keeps the previous amount'
);

select is(
  (
    select (payload ->> 'after_usd')::numeric
    from public.timeline
    where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b103'
  ),
  500::numeric,
  'the second balance USD is amount times usd_rate'
);

select lives_ok(
  $$
    update public.account_balances
    set deleted_at = now()
    where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b103'
  $$,
  'user A can soft-delete a balance'
);

select is(
  (
    select count(*)
    from public.timeline
    where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b103'
  ),
  0::bigint,
  'a soft-deleted balance leaves the timeline'
);

select is(
  (
    select count(*)
    from public.timeline
    where kind = 'balance_recorded'
      and ref_id = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a102'
  ),
  1::bigint,
  'the other live balance stays on the timeline'
);

select lives_ok(
  $$
    insert into public.asset_accounts (id, name, currency)
    values ('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a103', 'A103', 'USD')
  $$,
  'user A can insert the holding account'
);

select lives_ok(
  $$
    insert into public.holdings (id, account_id, symbol, quantity, cost_basis_usd)
    values (
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c102',
      'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a103',
      'ABC',
      3,
      10
    )
  $$,
  'user A can insert the holding that will be removed'
);

select is(
  (
    select count(*)
    from public.timeline
    where kind = 'holding_added'
      and ref_id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c102'
  ),
  1::bigint,
  'adding a holding records holding_added'
);

select lives_ok(
  $$
    update public.holdings
    set deleted_at = now()
    where id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c102'
  $$,
  'user A can soft-delete a holding'
);

select is(
  (
    select count(*)
    from public.timeline
    where kind = 'holding_added'
      and ref_id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c102'
  ),
  1::bigint,
  'holding_added stays after the holding is deleted'
);

select is(
  (
    select count(*)
    from public.timeline
    where kind = 'holding_removed'
      and ref_id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c102'
  ),
  1::bigint,
  'deleting a holding records holding_removed'
);

select is(
  (
    select (payload ->> 'before_quantity')::numeric
    from public.timeline
    where kind = 'holding_removed'
      and ref_id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c102'
  ),
  3::numeric,
  'holding_removed keeps the quantity from before the delete'
);

select lives_ok(
  $$
    insert into public.asset_accounts (id, name, currency)
    values ('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a104', 'A104', 'USD')
  $$,
  'user A can insert an account with no holdings'
);

select lives_ok(
  $$
    insert into public.account_balances (id, account_id, amount, usd_rate, recorded_at, tz, local_day)
    values (
      'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b104',
      'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a104',
      80,
      1,
      timestamptz '2026-10-27 01:00:00+00',
      'Asia/Singapore',
      date '2026-10-27'
    )
  $$,
  'user A can insert a balance on the account that will be deleted'
);

select lives_ok(
  $$
    update public.asset_accounts
    set deleted_at = now()
    where id = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a104'
  $$,
  'user A can soft-delete an account that has no live holdings'
);

select is(
  (
    select count(*)
    from public.timeline
    where kind = 'balance_recorded'
      and ref_id = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a104'
  ),
  0::bigint,
  'balance events disappear after the account is deleted'
);

select is(
  (
    select count(*)
    from public.account_balances
    where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b104'
  ),
  1::bigint,
  'the balance row remains after the account is soft-deleted'
);

select lives_ok(
  $$
    insert into public.asset_accounts (id, name, currency)
    values ('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a105', 'A105', 'USD')
  $$,
  'user A can insert a second account for the immutable-column check'
);

select lives_ok(
  $$
    insert into public.holdings (id, account_id, symbol, quantity, cost_basis_usd)
    values (
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c103',
      'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a103',
      'ABC',
      3,
      10
    )
  $$,
  'user A can insert a holding whose identity stays fixed'
);

select throws_ok(
  $$
    update public.holdings
    set symbol = 'ZZZ'
    where id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c103'
  $$,
  'P0001',
  'immutable column',
  'updating a holding symbol is rejected'
);

select throws_ok(
  $$
    update public.holdings
    set account_id = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a105'
    where id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c103'
  $$,
  'P0001',
  'immutable column',
  'updating a holding account_id is rejected'
);

select lives_ok(
  $$
    update public.holdings
    set quantity = 4
    where id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c103'
  $$,
  'updating a holding quantity still succeeds'
);

select is(
  (
    select quantity
    from public.holdings
    where id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c103'
  ),
  4::numeric,
  'the new holding quantity is stored'
);

select lives_ok(
  $$
    insert into public.push_subscriptions (id, endpoint, p256dh, auth, tz)
    values (
      'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f102',
      'https://push.example.test/1102',
      'k1102',
      's1102',
      'Asia/Singapore'
    )
  $$,
  'user A can insert a push subscription with default reminder times'
);

select is(
  (
    select month_end_time
    from public.push_subscriptions
    where id = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f102'
  ),
  time '21:30',
  'month-end reminder defaults to 21:30'
);

select is(
  (
    select training_time
    from public.push_subscriptions
    where id = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f102'
  ),
  time '08:00',
  'training reminder defaults to 08:00'
);

select is(
  (
    select training_enabled
    from public.push_subscriptions
    where id = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f102'
  ),
  false,
  'training reminder defaults to off'
);

select is(
  (
    select month_end_enabled
    from public.push_subscriptions
    where id = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f102'
  ),
  false,
  'month-end reminder defaults to off'
);

select throws_ok(
  $$
    insert into public.push_subscriptions (id, endpoint, p256dh, auth, tz, training_days)
    values (
      'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f106',
      'https://push.example.test/1106',
      'k1106',
      's1106',
      'Asia/Singapore',
      null
    )
  $$,
  '23502',
  NULL::text,
  'a null training_days value is rejected'
);

select lives_ok(
  $$
    insert into public.push_subscriptions (
      id, endpoint, p256dh, auth, tz, training_enabled
    )
    values (
      'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f107',
      'https://push.example.test/1107',
      'k1107',
      's1107',
      'Asia/Singapore',
      true
    )
  $$,
  'user A can turn on only the training reminder'
);

select is(
  (
    select training_enabled
    from public.push_subscriptions
    where id = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f107'
  ),
  true,
  'the training reminder flag that was written is on'
);

select is(
  (
    select month_end_enabled
    from public.push_subscriptions
    where id = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f107'
  ),
  false,
  'writing only the training flag leaves the month-end flag off'
);

select lives_ok(
  $$
    insert into public.push_subscriptions (
      id, endpoint, p256dh, auth, tz, month_end_time, training_time, training_days
    )
    values (
      'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f103',
      'https://push.example.test/1103',
      'k1103',
      's1103',
      'Asia/Singapore',
      time '22:15',
      time '07:05',
      array[1, 3, 5]::smallint[]
    )
  $$,
  'user A can insert explicit reminder times'
);

select is(
  (
    select month_end_time
    from public.push_subscriptions
    where id = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f103'
  ),
  time '22:15',
  'month-end reminder round-trips'
);

select is(
  (
    select training_time
    from public.push_subscriptions
    where id = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f103'
  ),
  time '07:05',
  'training reminder round-trips'
);

select throws_ok(
  $$
    insert into public.push_subscriptions (id, endpoint, p256dh, auth, tz)
    values (
      'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f104',
      'https://push.example.test/1103',
      'k1104',
      's1104',
      'Asia/Singapore'
    )
  $$,
  '23505',
  NULL::text,
  'a second live subscription for the same endpoint is rejected'
);

select lives_ok(
  $$
    update public.push_subscriptions
    set deleted_at = now()
    where id = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f103'
  $$,
  'user A can soft-delete a push subscription'
);

select lives_ok(
  $$
    insert into public.push_subscriptions (id, endpoint, p256dh, auth, tz)
    values (
      'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f105',
      'https://push.example.test/1103',
      'k1105',
      's1105',
      'Asia/Singapore'
    )
  $$,
  'the same endpoint can be stored again after a soft delete'
);

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

select is(
  (select count(*) from public.push_subscriptions),
  0::bigint,
  'user B cannot read user A push subscriptions, including soft-deleted ones'
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

select throws_ok(
  $$delete from public.journal_entries where id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e101'$$,
  '42501',
  NULL::text,
  'authenticated cannot hard-delete a journal entry'
);

select throws_ok(
  $$delete from public.push_subscriptions where id = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f101'$$,
  '42501',
  NULL::text,
  'authenticated cannot hard-delete a push subscription'
);

select throws_ok(
  $$select count(*) from public.reminder_deliveries$$,
  '42501',
  NULL::text,
  'authenticated cannot select reminder deliveries'
);

select throws_ok(
  $$
    insert into public.reminder_deliveries (subscription_id, kind, local_day)
    values ('f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f101', 'training', date '2026-10-27')
  $$,
  '42501',
  NULL::text,
  'authenticated cannot insert reminder deliveries'
);

select throws_ok(
  $$update public.reminder_deliveries set kind = 'training'$$,
  '42501',
  NULL::text,
  'authenticated cannot update reminder deliveries'
);

select throws_ok(
  $$delete from public.reminder_deliveries$$,
  '42501',
  NULL::text,
  'authenticated cannot delete reminder deliveries'
);

reset role;
set local role postgres;

select ok(
  has_table_privilege('authenticated', 'public.journal_entries', 'SELECT')
  and has_table_privilege('authenticated', 'public.journal_entries', 'INSERT')
  and has_table_privilege('authenticated', 'public.journal_entries', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.journal_entries', 'DELETE')
  and not has_table_privilege('authenticated', 'public.journal_entries', 'TRUNCATE')
  and not has_table_privilege('authenticated', 'public.journal_entries', 'REFERENCES')
  and not has_table_privilege('authenticated', 'public.journal_entries', 'TRIGGER'),
  'journal_entries grants authenticated only select, insert, and update'
);

select ok(
  has_table_privilege('authenticated', 'public.push_subscriptions', 'SELECT')
  and has_table_privilege('authenticated', 'public.push_subscriptions', 'INSERT')
  and has_table_privilege('authenticated', 'public.push_subscriptions', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.push_subscriptions', 'DELETE')
  and not has_table_privilege('authenticated', 'public.push_subscriptions', 'TRUNCATE')
  and not has_table_privilege('authenticated', 'public.push_subscriptions', 'REFERENCES')
  and not has_table_privilege('authenticated', 'public.push_subscriptions', 'TRIGGER'),
  'push_subscriptions grants authenticated only select, insert, and update'
);

select ok(
  has_table_privilege('authenticated', 'public.timeline', 'SELECT')
  and not has_table_privilege('authenticated', 'public.timeline', 'INSERT')
  and not has_table_privilege('authenticated', 'public.timeline', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.timeline', 'DELETE')
  and not has_table_privilege('anon', 'public.timeline', 'SELECT')
  and not has_table_privilege('anon', 'public.timeline', 'INSERT'),
  'timeline grants authenticated only select'
);

select ok(
  not has_table_privilege('authenticated', 'public.reminder_deliveries', 'SELECT')
  and not has_table_privilege('authenticated', 'public.reminder_deliveries', 'INSERT')
  and not has_table_privilege('authenticated', 'public.reminder_deliveries', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.reminder_deliveries', 'DELETE')
  and not has_table_privilege('anon', 'public.reminder_deliveries', 'SELECT')
  and not has_table_privilege('anon', 'public.reminder_deliveries', 'INSERT'),
  'reminder_deliveries grants nothing to authenticated or anon'
);

select lives_ok(
  $$
    insert into public.reminder_deliveries (subscription_id, kind, local_day)
    values ('f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f101', 'training', date '2026-10-27')
  $$,
  'a reminder delivery can be recorded for a subscription'
);

select throws_ok(
  $$
    insert into public.reminder_deliveries (subscription_id, kind, local_day)
    values ('f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f101', 'training', date '2026-10-27')
  $$,
  '23505',
  NULL::text,
  'a second reminder for the same subscription, kind, and day is rejected'
);

select * from finish();
rollback;
