/**
 * Pure serialization and merge helpers for the client-side record outbox.
 * Failed or offline saves stay in this outbox keyed by `userId` and record `id`
 * so closing the app or refreshing the page does not lose an unsaved weigh-in,
 * training set, or study session.
 */

import type { StudyRecord } from './study';
import type { TrainingSet } from './training';
import type { WeightRecord } from './weight-stats';

export type OutboxSnapshot = {
  weights: WeightRecord[];
  trainingSets: TrainingSet[];
  studyRecords: StudyRecord[];
};

export const EMPTY_OUTBOX: OutboxSnapshot = {
  weights: [],
  trainingSets: [],
  studyRecords: [],
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseWeightItem(raw: unknown): WeightRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(row.id) ||
    !isFiniteNumber(row.weightKg) ||
    row.weightKg <= 0 ||
    row.weightKg >= 500 ||
    !isNonEmptyString(row.recordedAt) ||
    !isNonEmptyString(row.tz) ||
    !isNonEmptyString(row.localDay) ||
    !isNonEmptyString(row.updatedAt)
  ) {
    return null;
  }
  return {
    id: row.id,
    weightKg: row.weightKg,
    recordedAt: row.recordedAt,
    tz: row.tz,
    localDay: row.localDay,
    updatedAt: row.updatedAt,
  };
}

function parseTrainingItem(raw: unknown): TrainingSet | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(row.id) ||
    !isNonEmptyString(row.exercise) ||
    !isFiniteNumber(row.reps) ||
    row.reps <= 0 ||
    !isNonEmptyString(row.recordedAt) ||
    !isNonEmptyString(row.tz) ||
    !isNonEmptyString(row.localDay) ||
    !isNonEmptyString(row.updatedAt)
  ) {
    return null;
  }
  const weightKg = row.weightKg === null ? null : isFiniteNumber(row.weightKg) ? row.weightKg : undefined;
  const bandLevel = row.bandLevel === null ? null : isNonEmptyString(row.bandLevel) ? row.bandLevel : undefined;
  if (weightKg === undefined || bandLevel === undefined) return null;
  return {
    id: row.id,
    exercise: row.exercise,
    reps: row.reps,
    weightKg,
    bandLevel,
    recordedAt: row.recordedAt,
    tz: row.tz,
    localDay: row.localDay,
    updatedAt: row.updatedAt,
  };
}

function parseStudyItem(raw: unknown): StudyRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (
    !isNonEmptyString(row.id) ||
    !isNonEmptyString(row.topic) ||
    !isFiniteNumber(row.durationMinutes) ||
    row.durationMinutes < 1 ||
    row.durationMinutes > 1440 ||
    !isNonEmptyString(row.recordedAt) ||
    !isNonEmptyString(row.tz) ||
    !isNonEmptyString(row.localDay) ||
    !isNonEmptyString(row.updatedAt)
  ) {
    return null;
  }
  const note = row.note === null ? null : typeof row.note === 'string' ? row.note : undefined;
  if (note === undefined) return null;
  return {
    id: row.id,
    topic: row.topic,
    durationMinutes: row.durationMinutes,
    note,
    recordedAt: row.recordedAt,
    tz: row.tz,
    localDay: row.localDay,
    updatedAt: row.updatedAt,
  };
}

export function parseOutboxJson(json: string | null): OutboxSnapshot {
  if (!json) return EMPTY_OUTBOX;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== 'object') return EMPTY_OUTBOX;
    const obj = parsed as Record<string, unknown>;
    const weights = Array.isArray(obj.weights)
      ? obj.weights.map(parseWeightItem).filter((item): item is WeightRecord => item !== null)
      : [];
    const trainingSets = Array.isArray(obj.trainingSets)
      ? obj.trainingSets.map(parseTrainingItem).filter((item): item is TrainingSet => item !== null)
      : [];
    const studyRecords = Array.isArray(obj.studyRecords)
      ? obj.studyRecords.map(parseStudyItem).filter((item): item is StudyRecord => item !== null)
      : [];
    return { weights, trainingSets, studyRecords };
  } catch {
    return EMPTY_OUTBOX;
  }
}

export function upsertOutboxItem<T extends { id: string }>(list: readonly T[], item: T): T[] {
  const index = list.findIndex((existing) => existing.id === item.id);
  if (index === -1) return [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

export function removeOutboxItem<T extends { id: string }>(list: readonly T[], id: string): T[] {
  return list.filter((item) => item.id !== id);
}
