import { describe, expect, it } from '@jest/globals';

import {
  classifyHeartRateZone,
  parseBleHeartRateMeasurement,
  parseFitnessSyncPayload,
} from './wearable-sync';

describe('wearable-sync core', () => {
  it('parses standard BLE 0x2A37 UINT8 and UINT16 heart rate frames', () => {
    expect(parseBleHeartRateMeasurement([0x00, 142])).toBe(142);
    expect(parseBleHeartRateMeasurement([0x01, 0x90, 0x00])).toBe(144);
    expect(parseBleHeartRateMeasurement([0x00, 10])).toBeNull();
  });

  it('classifies heart rate training zones', () => {
    expect(classifyHeartRateZone(118, 190).zone).toBe(2);
    expect(classifyHeartRateZone(160, 190).zone).toBe(4);
    expect(classifyHeartRateZone(178, 190).zone).toBe(5);
  });

  it('parses Keep / Apple Health JSON and CSV fitness sync payloads', () => {
    const jsonPayload = JSON.stringify({
      heartRateBpm: 136,
      steps: 8640,
      caloriesKcal: 520,
      weights: [{ weightKg: 72.1, recordedAt: '2026-11-02T08:00:00Z' }],
      workouts: [
        {
          exercise: 'Keep 手环 · 燃脂HIIT',
          reps: 25,
          durationMinutes: 25,
          caloriesKcal: 310,
          avgHeartRateBpm: 148,
        },
      ],
    });
    const parsed = parseFitnessSyncPayload(jsonPayload);
    expect(parsed.latestHeartRateBpm).toBe(148);
    expect(parsed.stepsToday).toBe(8640);
    expect(parsed.weights).toHaveLength(1);
    expect(parsed.weights[0]?.weightKg).toBe(72.1);
    expect(parsed.workouts).toHaveLength(1);
    expect(parsed.workouts[0]?.exercise).toContain('Keep');
  });
});
