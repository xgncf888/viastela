-- Week 1: profile day-switch and weight records.
-- One table per record type. Training, study, and time blocks are not tables yet.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  day_switch time not null default '04:00',
  updated_at timestamptz not null default now()
);

create table public.weight_records (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  weight_kg numeric(6, 2) not null,
  recorded_at timestamptz not null,
  tz text not null,
  local_day date not null,
  updated_at timestamptz not null default now(),
  constraint weight_kg_range check (weight_kg > 0 and weight_kg < 500),
  constraint weight_tz_present check (char_length(tz) between 1 and 80)
);

create index weight_records_user_day_idx
  on public.weight_records (user_id, local_day, recorded_at);

comment on table public.weight_records is
  'Weight entries. Keep a separate table per record type; do not fold these into a generic log.';
comment on column public.weight_records.id is
  'Client-generated UUID. Resubmits upsert this id so a retry cannot insert a second row.';
comment on column public.weight_records.local_day is
  'Accounting day frozen at write time from tz and the user day-switch. Later setting changes do not rewrite it.';
comment on column public.weight_records.tz is
  'IANA timezone of the device when the row was written.';
comment on column public.profiles.day_switch is
  'Local time when a new accounting day starts. Default 04:00. Applies only to rows written after a change.';

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before insert or update on public.profiles
for each row execute function public.touch_updated_at();

create trigger weight_records_touch_updated_at
before insert or update on public.weight_records
for each row execute function public.touch_updated_at();

create or replace function public.assign_weight_user_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  new.user_id = auth.uid();
  return new;
end;
$$;

create trigger weight_records_assign_user
before insert or update on public.weight_records
for each row execute function public.assign_weight_user_id();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.assign_weight_user_id() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.weight_records enable row level security;

create policy profiles_select on public.profiles
for select to authenticated
using (user_id = (select auth.uid()));

create policy profiles_insert on public.profiles
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy profiles_update on public.profiles
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy weight_select on public.weight_records
for select to authenticated
using (user_id = (select auth.uid()));

create policy weight_insert on public.weight_records
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy weight_update on public.weight_records
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy weight_delete on public.weight_records
for delete to authenticated
using (user_id = (select auth.uid()));

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.weight_records to authenticated;
revoke all on table public.profiles from anon;
revoke all on table public.weight_records from anon;
