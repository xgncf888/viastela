import { describe, expect, it } from '@jest/globals';

import {
  buildOneTapWeightPresets,
  computeNextBestUserAction,
  ONE_TAP_FOCUS_PRESETS,
  ONE_TAP_WORKOUT_PRESETS,
} from './one-tap-flow';

describe('one-tap zero-friction user flow engine', () => {
  it('recommends morning weigh-in as Step 1 when weight is not logged today', () => {
    const plan = computeNextBestUserAction({
      hasWeightToday: false,
      hasFocusToday: false,
      hasWorkoutToday: false,
      hasEveningCheckInToday: false,
      lastWeightKg: 72.4,
    });
    expect(plan.recommendedStage).toBe('weight');
    expect(plan.completedSteps).toBe(0);
    expect(plan.headlineZh).toContain('72.4 kg');
  });

  it('advances to focus -> training -> evening as user completes each step with 1 tap', () => {
    const step2 = computeNextBestUserAction({
      hasWeightToday: true,
      hasFocusToday: false,
      hasWorkoutToday: false,
      hasEveningCheckInToday: false,
    });
    expect(step2.recommendedStage).toBe('focus');
    expect(step2.completedSteps).toBe(1);

    const step3 = computeNextBestUserAction({
      hasWeightToday: true,
      hasFocusToday: true,
      hasWorkoutToday: false,
      hasEveningCheckInToday: false,
    });
    expect(step3.recommendedStage).toBe('training');
    expect(step3.completedSteps).toBe(2);

    const step4 = computeNextBestUserAction({
      hasWeightToday: true,
      hasFocusToday: true,
      hasWorkoutToday: true,
      hasEveningCheckInToday: false,
    });
    expect(step4.recommendedStage).toBe('evening');
    expect(step4.completedSteps).toBe(3);

    const allDone = computeNextBestUserAction({
      hasWeightToday: true,
      hasFocusToday: true,
      hasWorkoutToday: true,
      hasEveningCheckInToday: true,
    });
    expect(allDone.completedSteps).toBe(4);
    expect(allDone.progressPct).toBe(100);
  });

  it('builds 5 one-tap weight presets centered around lastWeightKg', () => {
    const presets = buildOneTapWeightPresets(72.4);
    expect(presets).toHaveLength(5);
    expect(presets[0]?.weightKg).toBe(72.4);
    expect(presets[0]?.isPrimary).toBe(true);
    expect(presets.map((p) => p.weightKg)).toEqual([72.4, 72.2, 72.3, 72.5, 72.6]);
  });

  it('exposes ready-to-tap focus and workout presets', () => {
    expect(ONE_TAP_FOCUS_PRESETS.length).toBeGreaterThanOrEqual(4);
    expect(ONE_TAP_WORKOUT_PRESETS.length).toBeGreaterThanOrEqual(4);
  });
});
