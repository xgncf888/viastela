-- Not applied on the hosted database. 20261027051825 is the hosted version of
-- the init migration only (supabase/migrations/20261027051825_init.sql).
-- Future record tables copy this shape:
-- client uuid id, recorded_at, tz, local_day frozen at write, updated_at
-- (touch_updated_at), deleted_at, own-row RLS, and enforce_record_local_day.
-- Weight rows are soft-deleted. DELETE on weight_records is revoked.

alter table public.weight_records
  add column if not exists deleted_at timestamptz;

comment on column public.weight_records.deleted_at is
  'Soft delete. Null means live. Selects hide non-null rows. The app sets this instead of DELETE. Copy this column onto future record tables.';

comment on column public.weight_records.updated_at is
  'Set by weight_records_touch_updated_at on insert and update, including a soft delete.';

-- Restate the kilogram bounds in this migration. The init file already created the constraint.
alter table public.weight_records
  drop constraint if exists weight_kg_range;

alter table public.weight_records
  add constraint weight_kg_range check (weight_kg > 0 and weight_kg < 500);

comment on constraint weight_kg_range on public.weight_records is
  'Exclusive kilogram bounds, matching parseWeightKg. Not a medical limit.';

-- local_day may be the civil date of recorded_at in tz, or the previous civil date.
-- That covers the default 04:00 day-switch and any later switch on the same morning.
-- The user's exact switch is not stored on the row, so the database does not recompute it.
create or replace function public.enforce_record_local_day()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  civil date;
begin
  begin
    civil := (new.recorded_at at time zone new.tz)::date;
  exception
    when invalid_parameter_value then
      raise exception 'invalid timezone %', new.tz using errcode = '22023';
  end;

  if new.local_day is distinct from civil and new.local_day is distinct from (civil - 1) then
    raise exception 'local_day % must be % or the previous day in %', new.local_day, civil, new.tz
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists weight_records_enforce_local_day on public.weight_records;

create trigger weight_records_enforce_local_day
before insert or update on public.weight_records
for each row execute function public.enforce_record_local_day();

revoke all on function public.enforce_record_local_day() from public, anon, authenticated;

drop policy if exists weight_select on public.weight_records;

create policy weight_select on public.weight_records
for select to authenticated
using (user_id = (select auth.uid()) and deleted_at is null);

-- Owners can update a hidden row's other columns (USING matches user_id), but
-- the new row must still be live. An upsert of a soft-deleted id therefore
-- fails row-level security instead of rewriting the hidden row.
drop policy if exists weight_update on public.weight_records;

create policy weight_update on public.weight_records
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and deleted_at is null);

-- A direct UPDATE that sets deleted_at fails that check, and Postgres would
-- also apply the SELECT policy if the statement returned the new row.
-- This function runs as the owner, checks auth.uid() itself, and does not RETURNING.
create or replace function public.soft_delete_weight_record(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.weight_records
  set deleted_at = now()
  where id = target
    and user_id = auth.uid()
    and deleted_at is null;

  get diagnostics affected = row_count;
  if affected = 0 then
    raise exception 'weight record not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.soft_delete_weight_record(uuid) from public, anon, authenticated;
grant execute on function public.soft_delete_weight_record(uuid) to authenticated;

create index if not exists weight_records_active_user_day_idx
  on public.weight_records (user_id, local_day, recorded_at)
  where deleted_at is null;

-- Profiles had no delete policy. Owners may delete their own row; other users and anon may not.
create policy profiles_delete on public.profiles
for delete to authenticated
using (user_id = (select auth.uid()));

grant delete on table public.profiles to authenticated;

-- Soft delete only. A hard DELETE must not remove a weight row.
drop policy if exists weight_delete on public.weight_records;

revoke delete on table public.weight_records from authenticated;
