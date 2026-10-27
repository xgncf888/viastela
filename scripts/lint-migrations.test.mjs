import assert from 'node:assert/strict';
import test from 'node:test';

import { lintMigrationFiles, lintRepository } from './lint-migrations.mjs';

const FIXTURE = 'supabase/migrations/20990101000000_fixture.sql';

function lint(sql, allowlist = 'public.profiles\n', path = FIXTURE) {
  return lintMigrationFiles([{ path, sql }], allowlist);
}

function rules(result) {
  return result.findings.map((item) => item.rule);
}

test('existing migrations pass with no allowlisted violations', () => {
  const result = lintRepository();
  assert.deepEqual(
    result.findings.map((item) => `${item.file}:${item.line}: ${item.message}`),
    [],
  );
  assert.deepEqual(result.stale, []);
  assert.deepEqual(result.suppressed, []);

  const created = [...result.tables.entries()].filter(([, table]) => table.created);
  assert.equal(created.length, 13);
  for (const [key, table] of created) assert.equal(table.rls, true, key);

  const soft = created.filter(([, table]) => table.deletedAt).map(([key]) => key).sort();
  assert.deepEqual(soft, [
    'public.account_balances',
    'public.asset_accounts',
    'public.holdings',
    'public.net_worth_goals',
    'public.projection_assumptions',
    'public.study_records',
    'public.training_sets',
    'public.weight_records',
  ]);
  for (const [key, table] of created) {
    const forbid = [...table.triggers].some((name) => name.endsWith('_00_forbid_update_deleted'));
    assert.equal(forbid, table.deletedAt, key);
  }

  assert.deepEqual(
    result.definers.map((fn) => fn.name).sort(),
    ['public.handle_new_user', 'public.record_asset_event', 'public.soft_delete_weight_record'],
  );
  assert.ok(result.definers.every((fn) => fn.searchPath));
});

test('a table without row level security fails', () => {
  const result = lint('create table public.notes (id uuid primary key);', '');
  assert.deepEqual(rules(result), ['missing-rls']);
});

test('enable row level security in a later migration passes', () => {
  const result = lintMigrationFiles(
    [
      { path: 'supabase/migrations/a.sql', sql: 'create table public.notes (id uuid);' },
      { path: 'supabase/migrations/b.sql', sql: 'alter table public.notes enable row level security;' },
    ],
    '',
  );
  assert.deepEqual(result.findings, []);
});

test('deleted_at requires the 00 forbid trigger, including a column added later', () => {
  const created = lint(
    `create table public.notes (id uuid, deleted_at timestamptz);
     alter table public.notes enable row level security;
     create trigger notes_forbid_update_deleted
     before update on public.notes
     for each row execute function public.forbid_update_deleted();`,
    '',
  );
  assert.deepEqual(rules(created), ['missing-forbid-update-deleted']);

  const added = lintMigrationFiles(
    [
      {
        path: 'supabase/migrations/a.sql',
        sql: `create table public.notes (id uuid);
              alter table public.notes enable row level security;`,
      },
      {
        path: 'supabase/migrations/b.sql',
        sql: `alter table public.notes add column if not exists deleted_at timestamptz;
              create trigger notes_00_forbid_update_deleted
              before update on public.notes
              for each row execute function public.forbid_update_deleted();`,
      },
    ],
    '',
  );
  assert.deepEqual(added.findings, []);
});

test('policies, revokes, comments, schema grants, and function grants are not table grants', () => {
  const result = lint(
    `-- grant select on public.profiles to anon
     create table public.profiles (id uuid primary key);
     alter table public.profiles enable row level security;
     create policy profiles_select on public.profiles for select to anon using (true);
     create policy profiles_insert on public.profiles
       for insert to authenticated with check (true);
     revoke all on table public.profiles from public, anon, authenticated;
     grant usage on schema public to authenticated;
     grant execute on function public.touch_updated_at() to authenticated;
     comment on column public.profiles.id is 'grant select to anon';
     create index profiles_idx on public.profiles (id) where deleted_at is null;`,
  );
  assert.deepEqual(result.findings, []);
  assert.equal(result.tables.get('public.profiles').deletedAt, false);
});

test('grant to anon fails even when the table is allowlisted', () => {
  const result = lint(
    `create table public.profiles (id uuid);
     alter table public.profiles enable row level security;
     grant select on table public.profiles to anon;`,
  );
  assert.deepEqual(rules(result), ['grant-anon']);
});

test('grant to authenticated requires the allowlist, including multiline and column grants', () => {
  const sql = `create table public.profiles (id uuid);
    alter table public.profiles enable row level security;
    grant select, insert, update
      on table public.profiles
      to authenticated;
    grant select (id) on public.weight_records to authenticated;`;
  assert.deepEqual(rules(lint(sql, 'public.profiles\n')), ['grant-authenticated']);
  assert.deepEqual(rules(lint(sql, 'public.profiles\npublic.weight_records\n')), []);
});

test('grant on all tables in a schema fails', () => {
  const result = lint(
    `create table public.profiles (id uuid);
     alter table public.profiles enable row level security;
     grant select on all tables in schema public to authenticated;`,
    'public.profiles\n',
  );
  assert.deepEqual(rules(result), ['grant-authenticated']);
});

test('security definer must set search_path outside the body', () => {
  const insideBody = lint(
    `create function public.bad()
     returns void
     language plpgsql
     security definer
     as $$
     begin
       perform 'set search_path = public';
     end;
     $$;`,
    '',
  );
  assert.deepEqual(rules(insideBody), ['security-definer-search-path']);

  const afterBody = lint(
    `create function public.ok()
     returns void
     language plpgsql
     as $fn$
     begin
       perform 'security definer';
     end;
     $fn$
     security definer
     set search_path = '';`,
    '',
  );
  assert.deepEqual(afterBody.findings, []);
  assert.equal(afterBody.definers[0].searchPath, true);

  const invoker = lint(
    `create function public.plain()
     returns void
     language plpgsql
     as $$ begin perform 1; end; $$;`,
    '',
  );
  assert.deepEqual(invoker.findings, []);
  assert.deepEqual(invoker.definers, []);
});

test('a string default with commas still sees deleted_at', () => {
  const result = lint(
    `create table public.projection_assumptions (
       id uuid primary key,
       return_rates numeric(6, 4)[] not null default '{0.03,0.05,0.07}'::numeric(6, 4)[],
       deleted_at timestamptz,
       constraint projection_assumptions_return_rates check (
         cardinality(return_rates) = 3 and return_rates[1] >= -0.5
       )
     );
     alter table public.projection_assumptions enable row level security;
     create trigger projection_assumptions_00_forbid_update_deleted
     before update on public.projection_assumptions
     for each row execute function public.forbid_update_deleted();`,
    '',
  );
  assert.deepEqual(result.findings, []);
  assert.equal(result.tables.get('public.projection_assumptions').deletedAt, true);
});

test('a recorded violation is allowlisted and a stale row fails', () => {
  const sql = 'create table public.legacy (id uuid);';
  const recorded = lint(
    sql,
    'violation missing-rls supabase/migrations/20990101000000_fixture.sql public.legacy # shipped before RLS\n',
  );
  assert.deepEqual(recorded.findings, []);
  assert.equal(recorded.suppressed.length, 1);
  assert.match(recorded.suppressed[0].comment, /shipped before RLS/);

  const stale = lint('select 1;', 'violation missing-rls supabase/migrations/nope.sql public.nope # gone\n');
  assert.equal(stale.stale.length, 1);
});
