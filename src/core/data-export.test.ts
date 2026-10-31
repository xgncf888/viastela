import { describe, expect, it } from '@jest/globals';

import { backupFilename, buildPersonalDataBackup } from './data-export';

describe('data-export', () => {
  it('builds a sorted personal data backup payload with counts', () => {
    const backup = buildPersonalDataBackup({
      exportedAt: new Date('2026-10-31T08:00:00.000Z'),
      timeZone: 'Asia/Singapore',
      daySwitch: '04:00',
      weights: [
        {
          id: 'w-2',
          weightKg: 73.1,
          recordedAt: '2026-10-31T07:00:00.000Z',
          tz: 'Asia/Singapore',
          localDay: '2026-10-31',
          updatedAt: '2026-10-31T07:00:00.000Z',
        },
        {
          id: 'w-1',
          weightKg: 73.5,
          recordedAt: '2026-10-30T07:00:00.000Z',
          tz: 'Asia/Singapore',
          localDay: '2026-10-30',
          updatedAt: '2026-10-30T07:00:00.000Z',
        },
      ],
      trainingSets: [],
      studyRecords: [],
    });

    expect(backup.version).toBe(1);
    expect(backup.counts).toEqual({ weights: 2, trainingSets: 0, studyRecords: 0 });
    expect(backup.weights.map((item) => item.id)).toEqual(['w-1', 'w-2']);
  });

  it('formats a clean backup filename from localDay', () => {
    expect(backupFilename('2026-10-31')).toBe('viastela-backup-2026-10-31.json');
    expect(backupFilename('invalid')).toBe('viastela-backup-backup.json');
  });
});
