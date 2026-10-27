-- Not applied to the hosted project. The connector applies this after review.
-- Sorts after the asset_dashboard migration. The timeline view reads
-- asset_accounts, account_balances, and asset_events from that migration.
-- Soft delete is a plain update of deleted_at. Select policies check only the owner.
-- Grants are an allowlist: revoke everything, then the privileges the app uses.
-- Training sets and study records are not in this timeline.

create table public.journal_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  entry_day date not null,
  tz text not null,
  mood smallint,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint journal_body_present check (char_length(btrim(body)) between 1 and 2000),
  constraint journal_mood_range check (mood is null or mood between 1 and 5),
  constraint journal_tz_present check (char_length(tz) between 1 and 80)
);

comment on table public.journal_entries is
  'One journal entry per client id. body is the note. entry_day is the day it belongs to.';
comment on column public.journal_entries.id is
  'Client-generated UUID. Resubmits upsert this id so a retry cannot insert a second row.';
comment on column public.journal_entries.body is
  'Journal text. Length is measured after trimming ends, from 1 to 2000 characters.';
comment on column public.journal_entries.entry_day is
  'Day the entry belongs to. The enforce trigger rejects a day after the local today.';
comment on column public.journal_entries.tz is
  'IANA timezone used to decide whether entry_day is still today.';
comment on column public.journal_entries.mood is
  'Optional mood from 1 to 5. Null when the person left it blank.';
comment on column public.journal_entries.tags is
  'Up to 5 tags. Each tag is 1 to 20 characters and none of them is null.';
comment on column public.journal_entries.deleted_at is
  'Soft delete. Null means live. The app filters deleted rows on read.';

create index journal_entries_active_user_day_idx
  on public.journal_entries (user_id, entry_day desc)
  where deleted_at is null;

-- entry_day is not a frozen local_day of a recorded_at, so this is not
-- enforce_record_local_day. It only rejects a day after today in tz.
create or replace function public.enforce_journal_entry_day()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  today pg_catalog.date;
begin
  begin
    today := (pg_catalog.now() at time zone new.tz)::pg_catalog.date;
  exception
    when invalid_parameter_value then
      raise exception 'invalid timezone %', new.tz using errcode = '22023';
  end;

  if new.entry_day > today then
    raise exception 'entry_day % is after today % in %', new.entry_day, today, new.tz
      using errcode = '23514';
  end if;

  return new;
end;
$$;

comment on function public.enforce_journal_entry_day() is
  'Raises 23514 when entry_day is after the local today in tz.';

-- A check constraint cannot walk an array without a helper. The trigger can
-- raise 23514 and stay revoked from the API roles.
create or replace function public.enforce_journal_tags()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  tag text;
begin
  if new.tags is null or pg_catalog.cardinality(new.tags) > 5 then
    raise exception 'journal tags must contain at most 5 values' using errcode = '23514';
  end if;
  if pg_catalog.array_position(new.tags, null::text) is not null then
    raise exception 'journal tags cannot contain null' using errcode = '23514';
  end if;
  foreach tag in array new.tags loop
    if pg_catalog.char_length(tag) < 1 or pg_catalog.char_length(tag) > 20 then
      raise exception 'journal tag length must be 1 to 20' using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;

comment on function public.enforce_journal_tags() is
  'Raises 23514 when tags has more than 5 values, a null, or a value outside 1 to 20 characters.';

create trigger journal_entries_assign_user
before insert or update on public.journal_entries
for each row execute function public.assign_auth_user_id();

create trigger journal_entries_enforce_entry_day
before insert or update on public.journal_entries
for each row execute function public.enforce_journal_entry_day();

create trigger journal_entries_enforce_tags
before insert or update on public.journal_entries
for each row execute function public.enforce_journal_tags();

create trigger journal_entries_touch_updated_at
before insert or update on public.journal_entries
for each row execute function public.touch_updated_at();

-- The 00_ name sorts first among BEFORE UPDATE triggers, so P0001 wins over
-- an invalid timezone from enforce_journal_entry_day.
create trigger journal_entries_00_forbid_update_deleted
before update on public.journal_entries
for each row execute function public.forbid_update_deleted();

revoke all on function public.enforce_journal_entry_day() from public, anon, authenticated;
revoke all on function public.enforce_journal_tags() from public, anon, authenticated;

alter table public.journal_entries enable row level security;

create policy journal_select on public.journal_entries
for select to authenticated
using (user_id = (select auth.uid()));

create policy journal_insert on public.journal_entries
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy journal_update on public.journal_entries
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on table public.journal_entries from public, anon, authenticated;
grant select, insert, update on table public.journal_entries to authenticated;

create table public.push_subscriptions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  tz text not null,
  month_end_time time not null default time '21:30',
  month_end_enabled boolean not null default false,
  training_time time not null default time '08:00',
  training_days smallint[] not null default '{}',
  training_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint push_endpoint_https check (
    starts_with(endpoint, 'https://')
    and char_length(endpoint) > 8
  ),
  constraint push_p256dh_present check (char_length(btrim(p256dh)) between 1 and 200),
  constraint push_auth_present check (char_length(btrim(auth)) between 1 and 200),
  constraint push_tz_present check (char_length(tz) between 1 and 80),
  constraint push_training_days_range check (
    array_position(training_days, null::smallint) is null
    and training_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
  )
);

comment on table public.push_subscriptions is
  'One browser push subscription. Reminder times are stored as local time next to tz.';
comment on column public.push_subscriptions.id is
  'Client-generated UUID. Resubmits upsert this id so a retry cannot insert a second row.';
comment on column public.push_subscriptions.endpoint is
  'Push service URL. It must start with https://.';
comment on column public.push_subscriptions.p256dh is
  'Public key of this browser subscription.';
comment on column public.push_subscriptions.auth is
  'Auth secret of this browser subscription.';
comment on column public.push_subscriptions.tz is
  'IANA timezone the reminder times belong to.';
comment on column public.push_subscriptions.month_end_time is
  'Local time of the month-end reminder. Default 21:30.';
comment on column public.push_subscriptions.month_end_enabled is
  'Month-end reminder switch. Default false.';
comment on column public.push_subscriptions.training_time is
  'Local time of the training reminder. Default 08:00.';
comment on column public.push_subscriptions.training_days is
  'Weekday numbers from 1 to 7. Empty means no weekday is selected. Null is not allowed.';
comment on column public.push_subscriptions.training_enabled is
  'Training reminder switch. Default false.';
comment on column public.push_subscriptions.deleted_at is
  'Soft delete. Null means live. The same endpoint can be stored again after a soft delete.';

create unique index push_subscriptions_active_user_endpoint_idx
  on public.push_subscriptions (user_id, endpoint)
  where deleted_at is null;

create trigger push_subscriptions_assign_user
before insert or update on public.push_subscriptions
for each row execute function public.assign_auth_user_id();

create trigger push_subscriptions_touch_updated_at
before insert or update on public.push_subscriptions
for each row execute function public.touch_updated_at();

create trigger push_subscriptions_00_forbid_update_deleted
before update on public.push_subscriptions
for each row execute function public.forbid_update_deleted();

alter table public.push_subscriptions enable row level security;

create policy push_select on public.push_subscriptions
for select to authenticated
using (user_id = (select auth.uid()));

create policy push_insert on public.push_subscriptions
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy push_update on public.push_subscriptions
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on table public.push_subscriptions from public, anon, authenticated;
grant select, insert, update on table public.push_subscriptions to authenticated;

-- symbol and account_id identify the position. A later edit is a different holding.
-- forbid_deleted_parent on balances is unchanged.
create or replace function public.forbid_holding_immutable_column()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.symbol is distinct from old.symbol
     or new.account_id is distinct from old.account_id then
    raise exception 'immutable column' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function public.forbid_holding_immutable_column() is
  'Raises P0001 immutable column when symbol or account_id changes on a holding.';

create trigger holdings_forbid_immutable_column
before update on public.holdings
for each row execute function public.forbid_holding_immutable_column();

revoke all on function public.forbid_holding_immutable_column() from public, anon, authenticated;

-- security_invoker makes the caller's RLS on the underlying tables apply.
-- Balance USD is amount * usd_rate on that balance row. This view does not read fx_rates.
-- The first live balance of an account has no before_amount. A soft-deleted balance
-- drops out, and so does every live balance whose account is soft-deleted.
-- asset_events are all included, so holding_added stays after holding_removed.
create view public.timeline
with (security_invoker = true) as
with live_balances as (
  select
    account_balances.id,
    account_balances.user_id,
    account_balances.account_id,
    account_balances.recorded_at,
    account_balances.local_day,
    account_balances.amount,
    account_balances.usd_rate,
    lag(account_balances.amount) over balance_order as before_amount,
    lag(account_balances.usd_rate) over balance_order as before_usd_rate
  from public.account_balances
  join public.asset_accounts
    on asset_accounts.id = account_balances.account_id
   and asset_accounts.user_id = account_balances.user_id
  where account_balances.deleted_at is null
    and asset_accounts.deleted_at is null
  window balance_order as (
    partition by account_balances.user_id, account_balances.account_id
    order by account_balances.recorded_at, account_balances.id
  )
)
select
  events.kind,
  events.occurred_at,
  events.local_day,
  events.ref_id,
  events.payload,
  events.id
from (
  select
    'journal'::text as kind,
    journal_entries.created_at as occurred_at,
    journal_entries.entry_day as local_day,
    journal_entries.id as ref_id,
    jsonb_build_object(
      'body', journal_entries.body,
      'mood', journal_entries.mood,
      'tags', journal_entries.tags
    ) as payload,
    journal_entries.id
  from public.journal_entries
  where journal_entries.deleted_at is null

  union all

  select
    asset_events.kind::text as kind,
    asset_events.occurred_at,
    null::date as local_day,
    coalesce(asset_events.holding_id, asset_events.goal_id) as ref_id,
    jsonb_build_object(
      'holding_id', asset_events.holding_id,
      'goal_id', asset_events.goal_id,
      'symbol', asset_events.symbol,
      'before_quantity', asset_events.before_quantity,
      'after_quantity', asset_events.after_quantity,
      'before_usd', asset_events.before_usd,
      'after_usd', asset_events.after_usd
    ) as payload,
    asset_events.id
  from public.asset_events

  union all

  select
    'balance_recorded'::text as kind,
    live_balances.recorded_at as occurred_at,
    live_balances.local_day,
    live_balances.account_id as ref_id,
    case
      when live_balances.before_amount is null then
        jsonb_build_object(
          'after_amount', live_balances.amount,
          'usd_rate', live_balances.usd_rate,
          'after_usd', live_balances.amount * live_balances.usd_rate
        )
      else
        jsonb_build_object(
          'before_amount', live_balances.before_amount,
          'after_amount', live_balances.amount,
          'usd_rate', live_balances.usd_rate,
          'before_usd', live_balances.before_amount * live_balances.before_usd_rate,
          'after_usd', live_balances.amount * live_balances.usd_rate
        )
    end as payload,
    live_balances.id
  from live_balances
) as events;

comment on view public.timeline is
  'Journal entries, asset events, and balance changes for the calling user. Keyset order is (occurred_at, id).';

-- A UNION view is not auto-updatable. Postgres reports that as 55000 before it
-- checks grants, so an anonymous insert would not be 42501. INSTEAD OF triggers
-- make the write path a privilege check: roles without INSERT get 42501.
-- A role that does have INSERT still cannot change the underlying rows.
create or replace function public.reject_timeline_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'timeline is read only' using errcode = '55000';
end;
$$;

comment on function public.reject_timeline_write() is
  'Rejects writes that pass the timeline privilege check. The view is read only.';

create trigger timeline_reject_insert
instead of insert on public.timeline
for each row execute function public.reject_timeline_write();

create trigger timeline_reject_update
instead of update on public.timeline
for each row execute function public.reject_timeline_write();

create trigger timeline_reject_delete
instead of delete on public.timeline
for each row execute function public.reject_timeline_write();

revoke all on function public.reject_timeline_write() from public, anon, authenticated;

revoke all on table public.timeline from public, anon, authenticated;
grant select on table public.timeline to authenticated;
