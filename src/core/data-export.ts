/**
 * Builds and parses a structured personal data backup archive from the user's
 * weight records, training sets, study sessions, and full Sanctuary local state.
 */

import type { BookkeepingState } from './bookkeeping';
import type { PledgeVaultState, SanctuaryStageState, TimeCapsuleItem } from './life-gamification';
import type { HabitItem, LifeMilestone, OkrObjective } from './life-milestones-okr';
import type { StudyRecord } from './study';
import type { MasteryGoal, TimeBlockItem } from './time-block-tracker';
import type { TrainingSet } from './training';
import type { WeightRecord } from './weight-stats';

export type SanctuaryBackupSnapshot = {
  timeBlocks?: readonly TimeBlockItem[];
  masteryGoals?: readonly MasteryGoal[];
  objectives?: readonly OkrObjective[];
  habits?: readonly HabitItem[];
  milestones?: readonly LifeMilestone[];
  pledgeVault?: PledgeVaultState;
  stageState?: SanctuaryStageState;
  timeCapsules?: readonly TimeCapsuleItem[];
  bookkeeping?: BookkeepingState;
};

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
  sanctuary?: SanctuaryBackupSnapshot;
};

export function buildPersonalDataBackup(input: {
  exportedAt: Date;
  timeZone: string;
  daySwitch: string;
  weights: readonly WeightRecord[];
  trainingSets: readonly TrainingSet[];
  studyRecords: readonly StudyRecord[];
  sanctuary?: SanctuaryBackupSnapshot;
}): PersonalDataBackup {
  const weights = [...input.weights].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const trainingSets = [...input.trainingSets].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const studyRecords = [...input.studyRecords].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const result: PersonalDataBackup = {
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
  if (input.sanctuary) {
    result.sanctuary = input.sanctuary;
  }
  return result;
}

export function parsePersonalDataBackup(rawJson: string): PersonalDataBackup {
  const parsed = JSON.parse(rawJson) as Partial<PersonalDataBackup>;
  if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
    throw new Error('无效的备份文件格式（需为 version: 1 JSON）');
  }
  const weights = Array.isArray(parsed.weights) ? parsed.weights : [];
  const trainingSets = Array.isArray(parsed.trainingSets) ? parsed.trainingSets : [];
  const studyRecords = Array.isArray(parsed.studyRecords) ? parsed.studyRecords : [];
  return {
    version: 1,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    timeZone: typeof parsed.timeZone === 'string' ? parsed.timeZone : 'Asia/Singapore',
    daySwitch: typeof parsed.daySwitch === 'string' ? parsed.daySwitch : '04:00',
    counts: {
      weights: weights.length,
      trainingSets: trainingSets.length,
      studyRecords: studyRecords.length,
    },
    weights,
    trainingSets,
    studyRecords,
    ...(parsed.sanctuary && typeof parsed.sanctuary === 'object'
      ? { sanctuary: parsed.sanctuary }
      : {}),
  };
}

export function backupFilename(localDay: string): string {
  const safeDay = /^\d{4}-\d{2}-\d{2}$/.test(localDay) ? localDay : 'backup';
  return `viastela-backup-${safeDay}.json`;
}
