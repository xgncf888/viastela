-- Not applied to the hosted project. The connector applies this after review.
-- Soft delete is a plain update of deleted_at. Select policies check only the owner.
-- forbid_update_deleted rejects a later update of a deleted row with P0001.

create table public.training_sets (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise text not null,
  reps integer not null,
  weight numeric(6, 2),
  band_level text,
  recorded_at timestamptz not null,
  tz text not null,
  local_day date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint training_exercise_present check (char_length(btrim(exercise)) between 1 and 40),
  constraint training_reps_range check (reps between 1 and 999),
  constraint training_tz_present check (char_length(tz) between 1 and 80),
  constraint training_load_kind check (
    (
      weight is not null
      and band_level is null
      and weight > 0
      and weight < 500
    )
    or (
      weight is null
      and band_level is not null
      and char_length(btrim(band_level)) between 1 and 20
    )
  )
);

comment on table public.training_sets is
  'One row per training set. weight and band_level are mutually exclusive.';
comment on column public.training_sets.id is
  'Client-generated UUID. Resubmits upsert this id so a retry cannot insert a second row.';
comment on column public.training_sets.weight is
  'Kilograms. Null when the set uses a band level.';
comment on column public.training_sets.band_level is
  'Band colour or level. Null when the set uses kilograms.';
comment on column public.training_sets.local_day is
  'Accounting day frozen at write time. Later day-switch changes do not rewrite it.';
comment on column public.training_sets.deleted_at is
  'Soft delete. Null means live. The app filters deleted rows on read.';

comment on column public.weight_records.deleted_at is
  'Soft delete. Null means live. Owners can select deleted rows. The app filters them on read. A later update raises P0001 record deleted.';

create index training_sets_active_user_day_idx
  on public.training_sets (user_id, local_day, recorded_at)
  where deleted_at is null;

create or replace function public.assign_auth_user_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  new.user_id = auth.uid();
  return new;
end;
$$;

create trigger training_sets_assign_user
before insert or update on public.training_sets
for each row execute function public.assign_auth_user_id();

create trigger training_sets_enforce_local_day
before insert or update on public.training_sets
for each row execute function public.enforce_record_local_day();

create trigger training_sets_touch_updated_at
before insert or update on public.training_sets
for each row execute function public.touch_updated_at();

-- Already-deleted rows cannot be updated or upserted. The first soft delete
-- (old.deleted_at is null) is allowed. Message and errcode are the app contract.
create or replace function public.forbid_update_deleted()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.deleted_at is not null then
    raise exception 'record deleted' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

comment on function public.forbid_update_deleted() is
  'Raises P0001 record deleted when a row with deleted_at set is updated.';

create trigger weight_records_forbid_update_deleted
before update on public.weight_records
for each row execute function public.forbid_update_deleted();

create trigger training_sets_forbid_update_deleted
before update on public.training_sets
for each row execute function public.forbid_update_deleted();

revoke all on function public.assign_auth_user_id() from public, anon, authenticated;
revoke all on function public.forbid_update_deleted() from public, anon, authenticated;

alter table public.training_sets enable row level security;

-- Owners can read their deleted rows. The app adds deleted_at is null.
drop policy if exists weight_select on public.weight_records;

create policy weight_select on public.weight_records
for select to authenticated
using (user_id = (select auth.uid()));

-- Soft delete is a plain update. WITH CHECK no longer rejects deleted_at.
drop policy if exists weight_update on public.weight_records;

create policy weight_update on public.weight_records
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy training_select on public.training_sets
for select to authenticated
using (user_id = (select auth.uid()));

create policy training_insert on public.training_sets
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy training_update on public.training_sets
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

grant select, insert, update on table public.training_sets to authenticated;
revoke delete on table public.training_sets from authenticated;
revoke all on table public.training_sets from anon;

-- soft_delete_weight_record stays. New deletes are plain updates.
