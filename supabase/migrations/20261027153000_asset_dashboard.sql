-- Not applied to the hosted project. The connector applies this after review.
-- Sorts after 20261027132914_study_records.sql.
-- Asset dashboard tables. Quote refresh stays in a later change.
-- Five-second undo is a client delay, so event triggers have no undo branch.
-- Soft delete is a plain update of deleted_at. Select policies check only the owner.
-- Grants are an allowlist: revoke everything, then the privileges the app uses.
-- Drops soft_delete_weight_record(uuid). New deletes are plain updates.

create table public.asset_accounts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  currency text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint asset_accounts_name_length check (char_length(btrim(name)) between 1 and 40),
  constraint asset_accounts_currency check (currency in ('USD', 'CNY', 'SGD', 'HKD')),
  constraint asset_accounts_id_user_key unique (id, user_id)
);

comment on table public.asset_accounts is
  'One brokerage or cash account. name is 1 to 40 characters after trimming.';
comment on column public.asset_accounts.id is
  'Client-generated UUID. Resubmits upsert this id so a retry cannot insert a second row.';
comment on column public.asset_accounts.deleted_at is
  'Soft delete. Null means live. A live holding blocks the transition from null to a timestamp.';

create table public.account_balances (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  amount numeric(20, 4) not null,
  usd_rate numeric(20, 10),
  recorded_at timestamptz not null,
  tz text not null,
  local_day date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint account_balances_usd_rate_positive check (usd_rate is null or usd_rate > 0),
  constraint account_balances_tz_present check (char_length(tz) between 1 and 80),
  constraint account_balances_account_fkey
    foreign key (account_id, user_id)
    references public.asset_accounts (id, user_id)
    on delete cascade
);

comment on table public.account_balances is
  'Cash balance of one account at one instant. amount may be negative. usd_rate is the FX snapshot the client stored.';
comment on column public.account_balances.local_day is
  'Accounting day frozen at write time. Later day-switch changes do not rewrite it.';
comment on column public.account_balances.deleted_at is
  'Soft delete. Null means live. The app filters deleted rows on read.';

create index account_balances_active_user_account_idx
  on public.account_balances (user_id, account_id, recorded_at desc)
  where deleted_at is null;

create table public.holdings (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  symbol text not null,
  quantity numeric(20, 6) not null,
  cost_basis_usd numeric(20, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint holdings_symbol_format check (symbol ~ '^[A-Z][A-Z.]{0,9}$'),
  constraint holdings_quantity_positive check (quantity > 0),
  constraint holdings_cost_basis_nonnegative check (cost_basis_usd is null or cost_basis_usd >= 0),
  constraint holdings_account_fkey
    foreign key (account_id, user_id)
    references public.asset_accounts (id, user_id)
    on delete cascade
);

comment on table public.holdings is
  'One open symbol inside an account. A soft-deleted symbol can be inserted again.';
comment on column public.holdings.symbol is
  'Ticker, 1 to 10 characters: a leading letter, then letters or dots.';
comment on column public.holdings.deleted_at is
  'Soft delete. Null means live. The app filters deleted rows on read.';

create unique index holdings_live_account_symbol_idx
  on public.holdings (account_id, symbol)
  where deleted_at is null;

create table public.net_worth_goals (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  target_usd numeric(20, 4) not null,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint net_worth_goals_target_positive check (target_usd > 0)
);

comment on table public.net_worth_goals is
  'At most one live net-worth goal per user. target_date may be null.';
comment on column public.net_worth_goals.deleted_at is
  'Soft delete. Null means live. The app filters deleted rows on read.';

create unique index net_worth_goals_live_user_idx
  on public.net_worth_goals (user_id)
  where deleted_at is null;

create table public.projection_assumptions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  start_usd numeric(20, 4) not null,
  start_month date not null,
  monthly_net_usd numeric(20, 4),
  monthly_income_usd numeric(20, 4),
  monthly_expense_usd numeric(20, 4),
  return_rates numeric(6, 4)[] not null default '{0.03,0.05,0.07}'::numeric(6, 4)[],
  main_rate_index smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint projection_assumptions_start_usd_nonnegative check (start_usd >= 0),
  constraint projection_assumptions_start_month_first check (
    start_month = date_trunc('month', start_month)::date
  ),
  constraint projection_assumptions_cashflow check (
    (
      monthly_net_usd is not null
      and monthly_income_usd is null
      and monthly_expense_usd is null
    )
    or (
      monthly_net_usd is null
      and monthly_income_usd is not null
      and monthly_expense_usd is not null
      and monthly_income_usd >= 0
      and monthly_expense_usd >= 0
    )
  ),
  constraint projection_assumptions_return_rates check (
    cardinality(return_rates) = 3
    and return_rates[1] is not null
    and return_rates[2] is not null
    and return_rates[3] is not null
    and return_rates[1] >= -0.5
    and return_rates[1] <= 0.5
    and return_rates[2] >= -0.5
    and return_rates[2] <= 0.5
    and return_rates[3] >= -0.5
    and return_rates[3] <= 0.5
  ),
  constraint projection_assumptions_main_rate_index check (main_rate_index between 1 and 3)
);

comment on table public.projection_assumptions is
  'At most one live projection per user. Cashflow is either monthly_net_usd or income plus expense.';
comment on column public.projection_assumptions.return_rates is
  'Exactly three annual rates, each from -0.5 to 0.5. Default is 0.03, 0.05, 0.07.';
comment on column public.projection_assumptions.main_rate_index is
  '1-based index of the headline rate. Default 1.';
comment on column public.projection_assumptions.deleted_at is
  'Soft delete. Null means live. The app filters deleted rows on read.';

create unique index projection_assumptions_live_user_idx
  on public.projection_assumptions (user_id)
  where deleted_at is null;

-- Point-in-time totals. Upserted on (user_id, local_day). No soft delete.
create table public.net_worth_snapshots (
  user_id uuid not null references auth.users (id) on delete cascade,
  local_day date not null,
  tz text not null,
  total_usd numeric(20, 4) not null,
  cash_usd numeric(20, 4) not null,
  securities_usd numeric(20, 4) not null,
  as_of timestamptz not null,
  primary key (user_id, local_day),
  constraint net_worth_snapshots_tz_present check (char_length(tz) between 1 and 80)
);

comment on table public.net_worth_snapshots is
  'One net-worth total per user and accounting day. Later writes upsert the same key.';

-- Server-side caches. RLS is on and no policy is granted, so the API roles cannot read or write.
create table public.quote_cache (
  symbol text primary key,
  price numeric(20, 4) not null,
  constraint quote_cache_price_nonnegative check (price >= 0)
);

comment on table public.quote_cache is
  'Latest quote keyed by symbol. No API policy; a later function writes it.';

create table public.fx_rates (
  base text not null,
  quote text not null,
  as_of timestamptz not null,
  rate numeric(20, 10) not null,
  primary key (base, quote, as_of),
  constraint fx_rates_rate_positive check (rate > 0)
);

comment on table public.fx_rates is
  'FX observation keyed by pair and time. No API policy; a later function writes it.';

create table public.asset_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  holding_id uuid,
  goal_id uuid,
  symbol text,
  before_quantity numeric(20, 6),
  after_quantity numeric(20, 6),
  before_usd numeric(20, 4),
  after_usd numeric(20, 4),
  occurred_at timestamptz not null default now(),
  constraint asset_events_kind check (
    kind in ('holding_added', 'holding_removed', 'holding_changed', 'goal_changed')
  )
);

comment on table public.asset_events is
  'Append-only holding and goal events. Clients may select their own rows and cannot write.';
comment on column public.asset_events.holding_id is
  'Holding id copied onto the event. Not a foreign key, so the event outlives a hard delete of the holding.';
comment on column public.asset_events.goal_id is
  'Goal id copied onto the event. Not a foreign key.';

-- Reject a child write whose parent account is already soft-deleted.
-- Arguments are the parent table name and the foreign-key column on the child.
create or replace function public.forbid_deleted_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_table text := tg_argv[0];
  fk_column text := tg_argv[1];
  parent_id uuid;
  parent_deleted timestamptz;
begin
  execute format('select ($1).%I', fk_column)
    into parent_id
    using new;

  execute format(
    'select deleted_at from public.%I where id = $1 and user_id = $2',
    parent_table
  )
    into parent_deleted
    using parent_id, new.user_id;

  if parent_deleted is not null then
    raise exception 'parent deleted' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.forbid_deleted_parent() is
  'Raises P0001 parent deleted when the referenced parent row has deleted_at set.';

-- A live holding blocks soft-deleting its account. Balance rows do not.
create or replace function public.forbid_delete_account_with_holdings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    if exists (
      select 1
      from public.holdings
      where account_id = old.id
        and user_id = old.user_id
        and deleted_at is null
    ) then
      raise exception 'account has holdings' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.forbid_delete_account_with_holdings() is
  'Raises P0001 account has holdings when deleted_at is set while a live holding remains.';

-- user_id is always the row owner, including a postgres update with no JWT.
-- holding_removed stores the pre-delete quantity and cost in the before columns.
-- after_quantity and after_usd are null because the position is gone.
create or replace function public.record_asset_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_kind text;
  event_symbol text;
  event_holding uuid;
  event_goal uuid;
  event_before_quantity numeric(20, 6);
  event_after_quantity numeric(20, 6);
  event_before_usd numeric(20, 4);
  event_after_usd numeric(20, 4);
begin
  if tg_table_name = 'holdings' then
    if tg_op = 'INSERT' then
      event_kind := 'holding_added';
      event_symbol := new.symbol;
      event_holding := new.id;
      event_goal := null;
      event_before_quantity := null;
      event_after_quantity := new.quantity;
      event_before_usd := null;
      event_after_usd := new.cost_basis_usd;
    elsif old.deleted_at is null and new.deleted_at is not null then
      event_kind := 'holding_removed';
      event_symbol := old.symbol;
      event_holding := new.id;
      event_goal := null;
      event_before_quantity := old.quantity;
      event_after_quantity := null;
      event_before_usd := old.cost_basis_usd;
      event_after_usd := null;
    elsif new.quantity is distinct from old.quantity
      or new.cost_basis_usd is distinct from old.cost_basis_usd then
      event_kind := 'holding_changed';
      event_symbol := new.symbol;
      event_holding := new.id;
      event_goal := null;
      event_before_quantity := old.quantity;
      event_after_quantity := new.quantity;
      event_before_usd := old.cost_basis_usd;
      event_after_usd := new.cost_basis_usd;
    else
      return new;
    end if;
  elsif tg_table_name = 'net_worth_goals' then
    if tg_op = 'INSERT'
      or new.target_usd is distinct from old.target_usd
      or new.target_date is distinct from old.target_date then
      event_kind := 'goal_changed';
      event_symbol := null;
      event_holding := null;
      event_goal := new.id;
      event_before_quantity := null;
      event_after_quantity := null;
      if tg_op = 'INSERT' then
        event_before_usd := null;
      else
        event_before_usd := old.target_usd;
      end if;
      event_after_usd := new.target_usd;
    else
      return new;
    end if;
  else
    return new;
  end if;

  insert into public.asset_events (
    user_id,
    kind,
    holding_id,
    goal_id,
    symbol,
    before_quantity,
    after_quantity,
    before_usd,
    after_usd
  ) values (
    new.user_id,
    event_kind,
    event_holding,
    event_goal,
    event_symbol,
    event_before_quantity,
    event_after_quantity,
    event_before_usd,
    event_after_usd
  );

  return new;
end;
$$;

comment on function public.record_asset_event() is
  'Writes one holding or goal event. user_id is new.user_id. No-op updates write nothing.';

revoke all on function public.forbid_deleted_parent() from public, anon, authenticated;
revoke all on function public.forbid_delete_account_with_holdings() from public, anon, authenticated;
revoke all on function public.record_asset_event() from public, anon, authenticated;

create trigger asset_accounts_assign_user
before insert or update on public.asset_accounts
for each row execute function public.assign_auth_user_id();

create trigger asset_accounts_touch_updated_at
before insert or update on public.asset_accounts
for each row execute function public.touch_updated_at();

-- The 00_ name sorts first among BEFORE UPDATE triggers, so P0001 record deleted
-- wins over account has holdings and over an invalid timezone.
create trigger asset_accounts_00_forbid_update_deleted
before update on public.asset_accounts
for each row execute function public.forbid_update_deleted();

create trigger asset_accounts_forbid_delete_with_holdings
before update on public.asset_accounts
for each row execute function public.forbid_delete_account_with_holdings();

create trigger account_balances_assign_user
before insert or update on public.account_balances
for each row execute function public.assign_auth_user_id();

create trigger account_balances_enforce_local_day
before insert or update on public.account_balances
for each row execute function public.enforce_record_local_day();

create trigger account_balances_touch_updated_at
before insert or update on public.account_balances
for each row execute function public.touch_updated_at();

create trigger account_balances_00_forbid_update_deleted
before update on public.account_balances
for each row execute function public.forbid_update_deleted();

create trigger account_balances_forbid_deleted_parent
before insert or update on public.account_balances
for each row execute function public.forbid_deleted_parent('asset_accounts', 'account_id');

create trigger holdings_assign_user
before insert or update on public.holdings
for each row execute function public.assign_auth_user_id();

create trigger holdings_touch_updated_at
before insert or update on public.holdings
for each row execute function public.touch_updated_at();

create trigger holdings_00_forbid_update_deleted
before update on public.holdings
for each row execute function public.forbid_update_deleted();

create trigger holdings_forbid_deleted_parent
before insert or update on public.holdings
for each row execute function public.forbid_deleted_parent('asset_accounts', 'account_id');

create trigger holdings_record_asset_event
after insert or update on public.holdings
for each row execute function public.record_asset_event();

create trigger net_worth_goals_assign_user
before insert or update on public.net_worth_goals
for each row execute function public.assign_auth_user_id();

create trigger net_worth_goals_touch_updated_at
before insert or update on public.net_worth_goals
for each row execute function public.touch_updated_at();

create trigger net_worth_goals_00_forbid_update_deleted
before update on public.net_worth_goals
for each row execute function public.forbid_update_deleted();

create trigger net_worth_goals_record_asset_event
after insert or update on public.net_worth_goals
for each row execute function public.record_asset_event();

create trigger projection_assumptions_assign_user
before insert or update on public.projection_assumptions
for each row execute function public.assign_auth_user_id();

create trigger projection_assumptions_touch_updated_at
before insert or update on public.projection_assumptions
for each row execute function public.touch_updated_at();

create trigger projection_assumptions_00_forbid_update_deleted
before update on public.projection_assumptions
for each row execute function public.forbid_update_deleted();

create trigger net_worth_snapshots_assign_user
before insert or update on public.net_worth_snapshots
for each row execute function public.assign_auth_user_id();

alter table public.asset_accounts enable row level security;
alter table public.account_balances enable row level security;
alter table public.holdings enable row level security;
alter table public.net_worth_goals enable row level security;
alter table public.projection_assumptions enable row level security;
alter table public.net_worth_snapshots enable row level security;
alter table public.quote_cache enable row level security;
alter table public.fx_rates enable row level security;
alter table public.asset_events enable row level security;

create policy asset_accounts_select on public.asset_accounts
for select to authenticated
using (user_id = (select auth.uid()));

create policy asset_accounts_insert on public.asset_accounts
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy asset_accounts_update on public.asset_accounts
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy account_balances_select on public.account_balances
for select to authenticated
using (user_id = (select auth.uid()));

create policy account_balances_insert on public.account_balances
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy account_balances_update on public.account_balances
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy holdings_select on public.holdings
for select to authenticated
using (user_id = (select auth.uid()));

create policy holdings_insert on public.holdings
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy holdings_update on public.holdings
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy net_worth_goals_select on public.net_worth_goals
for select to authenticated
using (user_id = (select auth.uid()));

create policy net_worth_goals_insert on public.net_worth_goals
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy net_worth_goals_update on public.net_worth_goals
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy projection_assumptions_select on public.projection_assumptions
for select to authenticated
using (user_id = (select auth.uid()));

create policy projection_assumptions_insert on public.projection_assumptions
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy projection_assumptions_update on public.projection_assumptions
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy net_worth_snapshots_select on public.net_worth_snapshots
for select to authenticated
using (user_id = (select auth.uid()));

create policy net_worth_snapshots_insert on public.net_worth_snapshots
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy net_worth_snapshots_update on public.net_worth_snapshots
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy asset_events_select on public.asset_events
for select to authenticated
using (user_id = (select auth.uid()));

-- Default privileges may grant truncate, references, and trigger.
revoke all on table public.asset_accounts from public, anon, authenticated;
grant select, insert, update on table public.asset_accounts to authenticated;

revoke all on table public.account_balances from public, anon, authenticated;
grant select, insert, update on table public.account_balances to authenticated;

revoke all on table public.holdings from public, anon, authenticated;
grant select, insert, update on table public.holdings to authenticated;

revoke all on table public.net_worth_goals from public, anon, authenticated;
grant select, insert, update on table public.net_worth_goals to authenticated;

revoke all on table public.projection_assumptions from public, anon, authenticated;
grant select, insert, update on table public.projection_assumptions to authenticated;

revoke all on table public.net_worth_snapshots from public, anon, authenticated;
grant select, insert, update on table public.net_worth_snapshots to authenticated;

revoke all on table public.quote_cache from public, anon, authenticated;
revoke all on table public.fx_rates from public, anon, authenticated;

revoke all on table public.asset_events from public, anon, authenticated;
grant select on table public.asset_events to authenticated;

drop function public.soft_delete_weight_record(target uuid);
