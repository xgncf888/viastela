-- Not applied to the hosted project. The connector applies this after review.
-- Depends on the training_sets migration: assign_auth_user_id and forbid_update_deleted.
-- Soft delete is a plain update of deleted_at. Select policies check only the owner.
-- Grants are an allowlist: revoke everything, then select, insert, and update.

create table public.study_records (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  topic text not null,
  duration_minutes integer not null,
  note text,
  recorded_at timestamptz not null,
  tz text not null,
  local_day date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint study_topic_present check (char_length(btrim(topic)) between 1 and 40),
  constraint study_duration_range check (duration_minutes between 1 and 1440),
  constraint study_note_length check (note is null or char_length(btrim(note)) between 1 and 200),
  constraint study_tz_present check (char_length(tz) between 1 and 80)
);

comment on table public.study_records is
  'One row per study session. topic is what was studied. duration_minutes is a positive length.';
comment on column public.study_records.id is
  'Client-generated UUID. Resubmits upsert this id so a retry cannot insert a second row.';
comment on column public.study_records.topic is
  'What was studied, 1 to 40 characters.';
comment on column public.study_records.duration_minutes is
  'Minutes spent. Greater than 0 and at most 1440.';
comment on column public.study_records.note is
  'Optional one-line takeaway. Null when the person left it blank.';
comment on column public.study_records.local_day is
  'Accounting day frozen at write time. Later day-switch changes do not rewrite it.';
comment on column public.study_records.deleted_at is
  'Soft delete. Null means live. The app filters deleted rows on read.';

create index study_records_active_user_day_idx
  on public.study_records (user_id, local_day, recorded_at)
  where deleted_at is null;

create trigger study_records_assign_user
before insert or update on public.study_records
for each row execute function public.assign_auth_user_id();

create trigger study_records_enforce_local_day
before insert or update on public.study_records
for each row execute function public.enforce_record_local_day();

create trigger study_records_touch_updated_at
before insert or update on public.study_records
for each row execute function public.touch_updated_at();

-- The 00_ name sorts first among BEFORE UPDATE triggers, so P0001 wins over
-- an invalid timezone from enforce_record_local_day.
create trigger study_records_00_forbid_update_deleted
before update on public.study_records
for each row execute function public.forbid_update_deleted();

alter table public.study_records enable row level security;

create policy study_select on public.study_records
for select to authenticated
using (user_id = (select auth.uid()));

create policy study_insert on public.study_records
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy study_update on public.study_records
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Default privileges may grant truncate, references, and trigger.
-- Revoke first, then allow only the writes the app uses.
revoke all on table public.study_records from public, anon, authenticated;
grant select, insert, update on table public.study_records to authenticated;

revoke all on table public.training_sets from authenticated;
grant select, insert, update on table public.training_sets to authenticated;
