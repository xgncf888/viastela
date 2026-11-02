import { describe, expect, it } from '@jest/globals';

import {
  classifyHeartRateZone,
  DEFAULT_WEARABLE_GRANTS,
  parseBleHeartRateMeasurement,
  parseBleWeightScaleMeasurement,
  parseFitnessSyncPayload,
  parseHealthSyncUrlParams,
} from './wearable-sync';

describe('wearable-sync core', () => {
  it('parses standard BLE 0x2A37 UINT8 and UINT16 heart rate frames', () => {
    expect(parseBleHeartRateMeasurement([0x00, 142])).toBe(142);
    expect(parseBleHeartRateMeasurement([0x01, 0x90, 0x00])).toBe(144);
    expect(parseBleHeartRateMeasurement([0x00, 10])).toBeNull();
  });

  it('parses standard BLE 0x2A9D smart scale weight measurement frames in kg and lbs', () => {
    // 72.40 kg in 0.005 kg units => 14480 => 0x3890 => [0x20, 0x90, 0x38]
    const siFrame = parseBleWeightScaleMeasurement([0x20, 0x90, 0x38]);
    expect(siFrame).toEqual({ weightKg: 72.4, stabilized: true });

    // Imperial 160.00 lbs => 16000 => 0x3E80 => [0x01, 0x80, 0x3E] => ~72.57 kg
    const lbFrame = parseBleWeightScaleMeasurement([0x01, 0x80, 0x3e]);
    expect(lbFrame?.weightKg).toBeCloseTo(72.57, 2);
  });

  it('classifies heart rate training zones and exposes default authorization grants', () => {
    expect(classifyHeartRateZone(118, 190).zone).toBe(2);
    expect(classifyHeartRateZone(160, 190).zone).toBe(4);
    expect(classifyHeartRateZone(178, 190).zone).toBe(5);
    expect(DEFAULT_WEARABLE_GRANTS).toHaveLength(5);
  });

  it('parses URL deep-link health_sync parameters for iOS Shortcuts / Android automation', () => {
    const parsed = parseHealthSyncUrlParams(
      '?health_sync=1&weight=72.2&hr=142&kcal=510&steps=9200&workout=HIIT&mins=25',
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.weights[0]?.weightKg).toBe(72.2);
    expect(parsed?.latestHeartRateBpm).toBe(142);
    expect(parsed?.activeCaloriesToday).toBe(510);
    expect(parsed?.stepsToday).toBe(9200);
    expect(parsed?.workouts[0]?.exercise).toBe('Keep · HIIT');
  });

  it('parses Keep / Apple Health / Intervals.icu JSON and CSV fitness sync payloads', () => {
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
