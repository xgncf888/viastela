import {
  EMPTY_OUTBOX,
  parseOutboxJson,
  removeOutboxItem,
  upsertOutboxItem,
  type OutboxSnapshot,
} from '@/core/record-outbox';
import type { StudyRecord } from '@/core/study';
import type { TrainingSet } from '@/core/training';
import type { WeightRecord } from '@/core/weight-stats';

import { localStore } from './local-store';

const PREFIX = 'viastela.record-outbox.v1.';

export function recordOutboxKey(userId: string): string {
  if (userId.trim().length === 0) throw new Error('userId is required');
  return `${PREFIX}${userId}`;
}

export async function readRecordOutbox(userId: string): Promise<OutboxSnapshot> {
  if (userId.trim().length === 0) return EMPTY_OUTBOX;
  try {
    const store = await localStore();
    const raw = await store.getItem(recordOutboxKey(userId));
    return parseOutboxJson(raw);
  } catch {
    return EMPTY_OUTBOX;
  }
}

async function writeRecordOutbox(userId: string, snapshot: OutboxSnapshot): Promise<void> {
  if (userId.trim().length === 0) return;
  try {
    const store = await localStore();
    const isEmpty =
      snapshot.weights.length === 0 &&
      snapshot.trainingSets.length === 0 &&
      snapshot.studyRecords.length === 0;
    if (isEmpty) {
      await store.removeItem(recordOutboxKey(userId));
    } else {
      await store.setItem(recordOutboxKey(userId), JSON.stringify(snapshot));
    }
  } catch {
    // Storage write failures must not crash the UI.
  }
}

export async function saveOutboxWeight(userId: string, record: WeightRecord): Promise<void> {
  const current = await readRecordOutbox(userId);
  await writeRecordOutbox(userId, {
    ...current,
    weights: upsertOutboxItem(current.weights, record),
  });
}

export async function removeOutboxWeight(userId: string, id: string): Promise<void> {
  const current = await readRecordOutbox(userId);
  await writeRecordOutbox(userId, {
    ...current,
    weights: removeOutboxItem(current.weights, id),
  });
}

export async function saveOutboxTrainingSet(userId: string, set: TrainingSet): Promise<void> {
  const current = await readRecordOutbox(userId);
  await writeRecordOutbox(userId, {
    ...current,
    trainingSets: upsertOutboxItem(current.trainingSets, set),
  });
}

export async function removeOutboxTrainingSet(userId: string, id: string): Promise<void> {
  const current = await readRecordOutbox(userId);
  await writeRecordOutbox(userId, {
    ...current,
    trainingSets: removeOutboxItem(current.trainingSets, id),
  });
}

export async function saveOutboxStudyRecord(userId: string, record: StudyRecord): Promise<void> {
  const current = await readRecordOutbox(userId);
  await writeRecordOutbox(userId, {
    ...current,
    studyRecords: upsertOutboxItem(current.studyRecords, record),
  });
}

export async function removeOutboxStudyRecord(userId: string, id: string): Promise<void> {
  const current = await readRecordOutbox(userId);
  await writeRecordOutbox(userId, {
    ...current,
    studyRecords: removeOutboxItem(current.studyRecords, id),
  });
}

export async function clearRecordOutbox(userId?: string): Promise<void> {
  try {
    const store = await localStore();
    if (userId === undefined) {
      const keys = await store.getAllKeys();
      await Promise.all(keys.filter((key) => key.startsWith(PREFIX)).map((key) => store.removeItem(key)));
      return;
    }
    if (userId.trim().length === 0) return;
    await store.removeItem(recordOutboxKey(userId));
  } catch {
    // Ignore storage clear errors during sign-out.
  }
}
