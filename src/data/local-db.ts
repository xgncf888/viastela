import { DEFAULT_DAY_SWITCH } from '@/core/local-day';
import type { RecentTopicRow, StudyRecord } from '@/core/study';
import type { RecentExerciseRow, TrainingSet } from '@/core/training';
import type { WeightRecord } from '@/core/weight-stats';
import { requireDeletedIds } from '@/core/weight-write';

import type {
  AccountBalanceRow,
  AssetAccountRow,
  AssetCurrency,
  AssetEventRow,
  AssumptionsRow,
  GoalRow,
  HoldingRow,
  SnapshotRow,
} from './assets';
import { localStore } from './local-store';
import type { JournalWrite, TimelineAccountRow, TimelineRecord } from './timeline';
import type { WeightDayWindow } from './weights';

const LOCAL_DB_STORAGE_KEY = 'viastela.local.engine.db.v1';

export type StoredJournalRow = JournalWrite & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type LocalEngineSnapshot = {
  version: 1;
  daySwitch: string;
  weights: (WeightRecord & { deletedAt: string | null })[];
  trainingSets: (TrainingSet & { deletedAt: string | null })[];
  studyRecords: (StudyRecord & { deletedAt: string | null })[];
  journals: StoredJournalRow[];
  assetAccounts: AssetAccountRow[];
  accountBalances: AccountBalanceRow[];
  holdings: HoldingRow[];
  goal: GoalRow | null;
  assumptions: AssumptionsRow | null;
  snapshots: SnapshotRow[];
  assetEvents: AssetEventRow[];
};

function createEmptySnapshot(): LocalEngineSnapshot {
  return {
    version: 1,
    daySwitch: DEFAULT_DAY_SWITCH,
    weights: [],
    trainingSets: [],
    studyRecords: [],
    journals: [],
    assetAccounts: [],
    accountBalances: [],
    holdings: [],
    goal: null,
    assumptions: null,
    snapshots: [],
    assetEvents: [],
  };
}

export async function readLocalDb(): Promise<LocalEngineSnapshot> {
  try {
    const store = await localStore();
    const raw = await store.getItem(LOCAL_DB_STORAGE_KEY);
    if (!raw) return createEmptySnapshot();
    const parsed = JSON.parse(raw) as Partial<LocalEngineSnapshot>;
    if (!parsed || typeof parsed !== 'object') return createEmptySnapshot();
    return {
      version: 1,
      daySwitch: typeof parsed.daySwitch === 'string' ? parsed.daySwitch : DEFAULT_DAY_SWITCH,
      weights: Array.isArray(parsed.weights) ? parsed.weights : [],
      trainingSets: Array.isArray(parsed.trainingSets) ? parsed.trainingSets : [],
      studyRecords: Array.isArray(parsed.studyRecords) ? parsed.studyRecords : [],
      journals: Array.isArray(parsed.journals) ? parsed.journals : [],
      assetAccounts: Array.isArray(parsed.assetAccounts) ? parsed.assetAccounts : [],
      accountBalances: Array.isArray(parsed.accountBalances) ? parsed.accountBalances : [],
      holdings: Array.isArray(parsed.holdings) ? parsed.holdings : [],
      goal: parsed.goal ?? null,
      assumptions: parsed.assumptions ?? null,
      snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
      assetEvents: Array.isArray(parsed.assetEvents) ? parsed.assetEvents : [],
    };
  } catch {
    return createEmptySnapshot();
  }
}

export async function writeLocalDb(snapshot: LocalEngineSnapshot): Promise<void> {
  try {
    const store = await localStore();
    await store.setItem(LOCAL_DB_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota errors
  }
}

export async function clearLocalDb(): Promise<void> {
  try {
    const store = await localStore();
    await store.removeItem(LOCAL_DB_STORAGE_KEY);
  } catch {
    // Ignore storage clear errors
  }
}

export async function localGetDaySwitch(): Promise<string> {
  const db = await readLocalDb();
  return db.daySwitch || DEFAULT_DAY_SWITCH;
}

export async function localUpdateDaySwitch(daySwitch: string): Promise<void> {
  const db = await readLocalDb();
  await writeLocalDb({ ...db, daySwitch });
}

export async function localListWeightRecords(window: WeightDayWindow): Promise<WeightRecord[]> {
  const db = await readLocalDb();
  return db.weights
    .filter((row) => row.deletedAt === null && row.localDay >= window.fromDay && row.localDay <= window.toDay)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    .map(({ deletedAt: _deletedAt, ...record }) => record);
}

export async function localLatestWeightRecord(): Promise<WeightRecord | null> {
  const db = await readLocalDb();
  const newest = db.weights
    .filter((row) => row.deletedAt === null)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
  if (!newest) return null;
  const { deletedAt: _deletedAt, ...record } = newest;
  return record;
}

export async function localUpsertWeightRecord(record: WeightRecord): Promise<void> {
  const db = await readLocalDb();
  const nextRow = { ...record, deletedAt: null };
  const idx = db.weights.findIndex((row) => row.id === record.id);
  const weights =
    idx >= 0 ? db.weights.map((row, i) => (i === idx ? nextRow : row)) : [...db.weights, nextRow];
  await writeLocalDb({ ...db, weights });
}

export async function localSoftDeleteWeightRecord(id: string): Promise<void> {
  const db = await readLocalDb();
  const deletedIds: { id: string }[] = [];
  const nowIso = new Date().toISOString();
  const weights = db.weights.map((row) => {
    if (row.id !== id || row.deletedAt !== null) return row;
    deletedIds.push({ id: row.id });
    return { ...row, deletedAt: nowIso, updatedAt: nowIso };
  });
  requireDeletedIds(deletedIds);
  await writeLocalDb({ ...db, weights });
}

export async function localListTrainingSets(localDay: string): Promise<TrainingSet[]> {
  const db = await readLocalDb();
  return db.trainingSets
    .filter((row) => row.deletedAt === null && row.localDay === localDay)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    .map(({ deletedAt: _deletedAt, ...set }) => set);
}

export async function localListRecentExercises(): Promise<RecentExerciseRow[]> {
  const db = await readLocalDb();
  return db.trainingSets
    .filter((row) => row.deletedAt === null)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, 200)
    .map((row) => ({ exercise: row.exercise, recordedAt: row.recordedAt }));
}

export async function localUpsertTrainingSet(set: TrainingSet): Promise<void> {
  const db = await readLocalDb();
  const nextRow = { ...set, deletedAt: null };
  const idx = db.trainingSets.findIndex((row) => row.id === set.id);
  const trainingSets =
    idx >= 0 ? db.trainingSets.map((row, i) => (i === idx ? nextRow : row)) : [...db.trainingSets, nextRow];
  await writeLocalDb({ ...db, trainingSets });
}

export async function localSoftDeleteTrainingSet(id: string): Promise<void> {
  const db = await readLocalDb();
  const deletedIds: { id: string }[] = [];
  const nowIso = new Date().toISOString();
  const trainingSets = db.trainingSets.map((row) => {
    if (row.id !== id || row.deletedAt !== null) return row;
    deletedIds.push({ id: row.id });
    return { ...row, deletedAt: nowIso, updatedAt: nowIso };
  });
  requireDeletedIds(deletedIds);
  await writeLocalDb({ ...db, trainingSets });
}

export async function localListStudyRecords(localDay: string): Promise<StudyRecord[]> {
  const db = await readLocalDb();
  return db.studyRecords
    .filter((row) => row.deletedAt === null && row.localDay === localDay)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    .map(({ deletedAt: _deletedAt, ...record }) => record);
}

export async function localListRecentTopics(): Promise<RecentTopicRow[]> {
  const db = await readLocalDb();
  return db.studyRecords
    .filter((row) => row.deletedAt === null)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .slice(0, 200)
    .map((row) => ({ topic: row.topic, recordedAt: row.recordedAt }));
}

export async function localUpsertStudyRecord(record: StudyRecord): Promise<void> {
  const db = await readLocalDb();
  const nextRow = { ...record, deletedAt: null };
  const idx = db.studyRecords.findIndex((row) => row.id === record.id);
  const studyRecords =
    idx >= 0 ? db.studyRecords.map((row, i) => (i === idx ? nextRow : row)) : [...db.studyRecords, nextRow];
  await writeLocalDb({ ...db, studyRecords });
}

export async function localSoftDeleteStudyRecord(id: string): Promise<void> {
  const db = await readLocalDb();
  const deletedIds: { id: string }[] = [];
  const nowIso = new Date().toISOString();
  const studyRecords = db.studyRecords.map((row) => {
    if (row.id !== id || row.deletedAt !== null) return row;
    deletedIds.push({ id: row.id });
    return { ...row, deletedAt: nowIso, updatedAt: nowIso };
  });
  requireDeletedIds(deletedIds);
  await writeLocalDb({ ...db, studyRecords });
}

export async function localSaveJournal(entry: JournalWrite): Promise<void> {
  const db = await readLocalDb();
  const nowIso = new Date().toISOString();
  const idx = db.journals.findIndex((row) => row.id === entry.id);
  const existing = idx >= 0 ? db.journals[idx] : undefined;
  const nextRow: StoredJournalRow = {
    ...entry,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
    deletedAt: null,
  };
  const journals =
    idx >= 0 ? db.journals.map((row, i) => (i === idx ? nextRow : row)) : [...db.journals, nextRow];
  await writeLocalDb({ ...db, journals });
}

export async function localSoftDeleteJournal(id: string): Promise<void> {
  const db = await readLocalDb();
  const deletedIds: { id: string }[] = [];
  const nowIso = new Date().toISOString();
  const journals = db.journals.map((row) => {
    if (row.id !== id || row.deletedAt !== null) return row;
    deletedIds.push({ id: row.id });
    return { ...row, deletedAt: nowIso, updatedAt: nowIso };
  });
  requireDeletedIds(deletedIds);
  await writeLocalDb({ ...db, journals });
}

export async function localListTimelineAccounts(): Promise<TimelineAccountRow[]> {
  const db = await readLocalDb();
  return db.assetAccounts
    .filter((row) => row.deletedAt === null)
    .map((row) => ({ id: row.id, name: row.name, currency: row.currency }));
}

export async function localSelectTimeline(input: {
  localDay: 'null' | 'present';
  kind: 'journal' | 'balance_recorded' | null;
}): Promise<TimelineRecord[]> {
  const db = await readLocalDb();
  if (input.localDay === 'null') return [];
  const items: TimelineRecord[] = [];
  if (!input.kind || input.kind === 'journal') {
    for (const j of db.journals) {
      if (j.deletedAt !== null) continue;
      items.push({
        id: j.id,
        kind: 'journal',
        occurredAt: j.updatedAt,
        localDay: j.entryDay,
        refId: j.id,
        payload: { body: j.body, mood: j.mood, tags: j.tags },
      });
    }
  }
  if (!input.kind || input.kind === 'balance_recorded') {
    for (const b of db.accountBalances) {
      if (b.deletedAt !== null) continue;
      items.push({
        id: b.id,
        kind: 'balance_recorded',
        occurredAt: b.recordedAt,
        localDay: b.localDay,
        refId: b.accountId,
        payload: { account_id: b.accountId, amount: b.amount },
      });
    }
  }
  return items.sort(
    (a, b) =>
      (b.localDay ?? '').localeCompare(a.localDay ?? '') ||
      b.occurredAt.localeCompare(a.occurredAt) ||
      b.id.localeCompare(a.id),
  );
}

export async function localBalanceUpdatedThisMonth(start: string, end: string): Promise<boolean> {
  const db = await readLocalDb();
  return db.accountBalances.some(
    (row) => row.deletedAt === null && row.localDay >= start && row.localDay <= end,
  );
}

export async function localListAssetAccounts(): Promise<AssetAccountRow[]> {
  const db = await readLocalDb();
  return db.assetAccounts.filter((row) => row.deletedAt === null);
}

export async function localListAccountBalances(): Promise<AccountBalanceRow[]> {
  const db = await readLocalDb();
  return db.accountBalances
    .filter((row) => row.deletedAt === null)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

export async function localListHoldings(): Promise<HoldingRow[]> {
  const db = await readLocalDb();
  return db.holdings.filter((row) => row.deletedAt === null);
}

export async function localListGoal(): Promise<GoalRow | null> {
  const db = await readLocalDb();
  return db.goal;
}

export async function localListAssumptions(): Promise<AssumptionsRow | null> {
  const db = await readLocalDb();
  return db.assumptions;
}

export async function localListSnapshots(): Promise<SnapshotRow[]> {
  const db = await readLocalDb();
  return [...db.snapshots].sort((a, b) => a.localDay.localeCompare(b.localDay));
}

export async function localListAssetEvents(): Promise<AssetEventRow[]> {
  const db = await readLocalDb();
  return [...db.assetEvents].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 20);
}

export async function localInsertAccount(input: {
  id: string;
  name: string;
  currency: AssetCurrency;
}): Promise<void> {
  const db = await readLocalDb();
  const next: AssetAccountRow = {
    id: input.id,
    name: input.name.trim(),
    currency: input.currency,
    deletedAt: null,
  };
  await writeLocalDb({ ...db, assetAccounts: [...db.assetAccounts, next] });
}

export async function localInsertBalance(row: AccountBalanceRow): Promise<void> {
  const db = await readLocalDb();
  await writeLocalDb({ ...db, accountBalances: [row, ...db.accountBalances] });
}

export async function localInsertHolding(input: {
  id: string;
  accountId: string;
  symbol: string;
  quantity: number;
  costBasisUsd: number | null;
}): Promise<void> {
  const db = await readLocalDb();
  const next: HoldingRow = {
    id: input.id,
    accountId: input.accountId,
    symbol: input.symbol,
    quantity: input.quantity,
    costBasisUsd: input.costBasisUsd,
    deletedAt: null,
  };
  await writeLocalDb({ ...db, holdings: [...db.holdings, next] });
}

export async function localUpdateHolding(
  id: string,
  input: { quantity: number; costBasisUsd: number | null },
): Promise<void> {
  const db = await readLocalDb();
  const holdings = db.holdings.map((row) =>
    row.id === id ? { ...row, quantity: input.quantity, costBasisUsd: input.costBasisUsd } : row,
  );
  await writeLocalDb({ ...db, holdings });
}

export async function localSoftDeleteHolding(id: string): Promise<void> {
  const db = await readLocalDb();
  const deletedIds: { id: string }[] = [];
  const nowIso = new Date().toISOString();
  const holdings = db.holdings.map((row) => {
    if (row.id !== id || row.deletedAt !== null) return row;
    deletedIds.push({ id: row.id });
    return { ...row, deletedAt: nowIso };
  });
  requireDeletedIds(deletedIds);
  await writeLocalDb({ ...db, holdings });
}

export async function localSoftDeleteAccount(id: string): Promise<void> {
  const db = await readLocalDb();
  const deletedIds: { id: string }[] = [];
  const nowIso = new Date().toISOString();
  const assetAccounts = db.assetAccounts.map((row) => {
    if (row.id !== id || row.deletedAt !== null) return row;
    deletedIds.push({ id: row.id });
    return { ...row, deletedAt: nowIso };
  });
  requireDeletedIds(deletedIds);
  await writeLocalDb({ ...db, assetAccounts });
}

export async function localSaveAssumptions(input: AssumptionsRow): Promise<void> {
  const db = await readLocalDb();
  await writeLocalDb({ ...db, assumptions: input });
}

export async function localSaveGoal(input: GoalRow): Promise<void> {
  const db = await readLocalDb();
  await writeLocalDb({ ...db, goal: input });
}
