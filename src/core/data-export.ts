/**
 * Builds a structured personal data backup archive from the user's loaded
 * weight records, training sets, and study sessions.
 */

import type { StudyRecord } from './study';
import type { TrainingSet } from './training';
import type { WeightRecord } from './weight-stats';

export type PersonalDataBackup = {
  version: 1;
  exportedAt: string;
  timeZone: string;
  daySwitch: string;
  counts: {
    weights: number;
    trainingSets: number;
    studyRecords: number;
  };
  weights: readonly WeightRecord[];
  trainingSets: readonly TrainingSet[];
  studyRecords: readonly StudyRecord[];
};

export function buildPersonalDataBackup(input: {
  exportedAt: Date;
  timeZone: string;
  daySwitch: string;
  weights: readonly WeightRecord[];
  trainingSets: readonly TrainingSet[];
  studyRecords: readonly StudyRecord[];
}): PersonalDataBackup {
  const weights = [...input.weights].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const trainingSets = [...input.trainingSets].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const studyRecords = [...input.studyRecords].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  return {
    version: 1,
    exportedAt: input.exportedAt.toISOString(),
    timeZone: input.timeZone,
    daySwitch: input.daySwitch,
    counts: {
      weights: weights.length,
      trainingSets: trainingSets.length,
      studyRecords: studyRecords.length,
    },
    weights,
    trainingSets,
    studyRecords,
  };
}

export function backupFilename(localDay: string): string {
  const safeDay = /^\d{4}-\d{2}-\d{2}$/.test(localDay) ? localDay : 'backup';
  return `viastela-backup-${safeDay}.json`;
}
