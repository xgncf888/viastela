export type WearableSourceId = 'ble-hr' | 'keep' | 'apple-health' | 'health-connect';

export type WearableTelemetry = {
  source: WearableSourceId;
  deviceName: string;
  heartRateBpm: number | null;
  minHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  activeCaloriesKcal: number | null;
  steps: number | null;
  workoutMinutes: number | null;
  updatedAt: string;
};

export type KeepWorkoutImportItem = {
  id: string;
  exercise: string;
  reps: number;
  weightKg: number | null;
  durationMinutes: number;
  caloriesKcal: number | null;
  avgHeartRateBpm: number | null;
  recordedAt: string;
};

export type HealthImportSummary = {
  weights: { weightKg: number; recordedAt: string }[];
  workouts: KeepWorkoutImportItem[];
  latestHeartRateBpm: number | null;
  stepsToday: number | null;
  activeCaloriesToday: number | null;
};

export type HeartRateZone = {
  zone: 1 | 2 | 3 | 4 | 5;
  label: string;
  tone: 'neutral' | 'exec' | 'rev' | 'owner';
};

/**
 * Computes the standard 5-zone training heart rate zone based on current BPM and estimated max HR (default 190).
 */
export function classifyHeartRateZone(bpm: number, maxHr = 190): HeartRateZone {
  const ratio = bpm / Math.max(120, maxHr);
  if (ratio >= 0.9) {
    return { zone: 5, label: 'Z5 极限无氧', tone: 'owner' };
  }
  if (ratio >= 0.8) {
    return { zone: 4, label: 'Z4 乳酸阈值', tone: 'owner' };
  }
  if (ratio >= 0.7) {
    return { zone: 3, label: 'Z3 有氧耐力', tone: 'rev' };
  }
  if (ratio >= 0.6) {
    return { zone: 2, label: 'Z2 燃脂心率', tone: 'exec' };
  }
  return { zone: 1, label: 'Z1 热身恢复', tone: 'neutral' };
}

/**
 * Parses the standard Bluetooth Low Energy (BLE) Heart Rate Measurement Characteristic (`0x2A37`).
 * - Bit 0 of byte 0 (`flags & 0x01`): 0 => UINT8 BPM at byte 1; 1 => UINT16 little-endian BPM at bytes 1..2.
 */
export function parseBleHeartRateMeasurement(bytes: readonly number[]): number | null {
  if (bytes.length < 2) return null;
  const flags = bytes[0] ?? 0;
  const isUint16 = (flags & 0x01) === 1;
  let bpm: number;
  if (isUint16) {
    if (bytes.length < 3) return null;
    bpm = (bytes[1] ?? 0) | ((bytes[2] ?? 0) << 8);
  } else {
    bpm = bytes[1] ?? 0;
  }
  if (!Number.isFinite(bpm) || bpm < 25 || bpm > 250) return null;
  return bpm;
}

/**
 * Parses Keep / Apple Health / Xiaomi / Zepp / Garmin exported JSON or CSV text
 * into structured weight records, training sets, and daily telemetry.
 */
export function parseFitnessSyncPayload(rawText: string): HealthImportSummary {
  const trimmed = rawText.trim();
  const summary: HealthImportSummary = {
    weights: [],
    workouts: [],
    latestHeartRateBpm: null,
    stepsToday: null,
    activeCaloriesToday: null,
  };
  if (!trimmed) return summary;

  // 1. Try JSON format (Keep export / Apple Health Shortcut JSON / custom backup)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const items = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object'
          ? ((parsed as { records?: unknown[]; workouts?: unknown[]; data?: unknown[] }).records ??
            (parsed as { workouts?: unknown[] }).workouts ??
            (parsed as { data?: unknown[] }).data ?? [parsed])
          : [];

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const root = parsed as Record<string, unknown>;
        if (typeof root.heartRateBpm === 'number') summary.latestHeartRateBpm = root.heartRateBpm;
        if (typeof root.steps === 'number') summary.stepsToday = root.steps;
        if (typeof root.caloriesKcal === 'number') summary.activeCaloriesToday = root.caloriesKcal;
        if (Array.isArray(root.weights)) {
          for (const w of root.weights) {
            if (w && typeof w === 'object') {
              const kg = Number((w as Record<string, unknown>).weightKg ?? (w as Record<string, unknown>).weight);
              const at = String((w as Record<string, unknown>).recordedAt ?? (w as Record<string, unknown>).date ?? new Date().toISOString());
              if (Number.isFinite(kg) && kg >= 25 && kg <= 250) {
                summary.weights.push({ weightKg: Number(kg.toFixed(2)), recordedAt: at });
              }
            }
          }
        }
      }

      for (const rawItem of items) {
        if (!rawItem || typeof rawItem !== 'object') continue;
        const row = rawItem as Record<string, unknown>;
        const weightVal = Number(row.weightKg ?? row.weight_kg ?? row.bodyMassKg ?? row.weight);
        if (Number.isFinite(weightVal) && weightVal >= 25 && weightVal <= 250 && !row.exercise && !row.workoutName && !row.type) {
          summary.weights.push({
            weightKg: Number(weightVal.toFixed(2)),
            recordedAt: String(row.recordedAt ?? row.startDate ?? row.date ?? new Date().toISOString()),
          });
          continue;
        }

        const exerciseName = String(
          row.exercise ?? row.workoutName ?? row.name ?? row.title ?? row.sportType ?? '',
        ).trim();
        if (exerciseName) {
          const durationMin = Math.max(
            1,
            Math.round(Number(row.durationMinutes ?? row.duration_min ?? Number(row.durationSeconds ?? 0) / 60) || 20),
          );
          const reps = Math.max(
            1,
            Math.round(Number(row.reps ?? row.count ?? durationMin)),
          );
          const loadKg = Number(row.weightKg ?? row.loadKg ?? row.resistanceKg);
          const kcal = Number(row.caloriesKcal ?? row.calories ?? row.kcal);
          const hr = Number(row.avgHeartRateBpm ?? row.heartRate ?? row.avgHr);
          if (Number.isFinite(hr) && hr > 30) summary.latestHeartRateBpm = hr;
          if (Number.isFinite(kcal) && kcal > 0) {
            summary.activeCaloriesToday = (summary.activeCaloriesToday ?? 0) + Math.round(kcal);
          }
          summary.workouts.push({
            id: `keep-${summary.workouts.length + 1}`,
            exercise: exerciseName.startsWith('Keep') ? exerciseName : `Keep · ${exerciseName}`,
            reps,
            weightKg: Number.isFinite(loadKg) && loadKg > 0 ? loadKg : null,
            durationMinutes: durationMin,
            caloriesKcal: Number.isFinite(kcal) && kcal > 0 ? Math.round(kcal) : null,
            avgHeartRateBpm: Number.isFinite(hr) && hr > 30 ? Math.round(hr) : null,
            recordedAt: String(row.recordedAt ?? row.startTime ?? row.date ?? new Date().toISOString()),
          });
        }
      }
      return summary;
    } catch {
      // Fall through to CSV / Apple Health XML parser
    }
  }

  // 2. Apple Health XML snippet (`HKQuantityTypeIdentifierBodyMass`, `HKQuantityTypeIdentifierHeartRate`, `HKWorkout`)
  if (trimmed.includes('<Record') || trimmed.includes('<Workout')) {
    const massMatches = trimmed.matchAll(
      /type="HKQuantityTypeIdentifierBodyMass"[^>]*unit="kg"[^>]*startDate="([^"]+)"[^>]*value="([0-9.]+)"/g,
    );
    for (const m of massMatches) {
      const kg = Number.parseFloat(m[2] ?? '');
      if (Number.isFinite(kg) && kg >= 25 && kg <= 250) {
        summary.weights.push({
          weightKg: Number(kg.toFixed(2)),
          recordedAt: new Date(m[1] ?? Date.now()).toISOString(),
        });
      }
    }
    const hrMatches = [
      ...trimmed.matchAll(
        /type="HKQuantityTypeIdentifierHeartRate"[^>]*value="([0-9.]+)"/g,
      ),
    ];
    if (hrMatches.length > 0) {
      const lastHr = Number.parseFloat(hrMatches[hrMatches.length - 1]?.[1] ?? '');
      if (Number.isFinite(lastHr) && lastHr >= 30 && lastHr <= 240) {
        summary.latestHeartRateBpm = Math.round(lastHr);
      }
    }
    return summary;
  }

  // 3. CSV lines: `exercise,reps,weightKg,calories,heartRate` or `weight,72.4,2026-11-02`
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.toLowerCase().startsWith('type,') || line.toLowerCase().startsWith('exercise,')) {
      continue;
    }
    const cols = line.split(',').map((c) => c.trim());
    if (cols.length >= 2 && (cols[0]?.toLowerCase() === 'weight' || cols[0] === '体重')) {
      const kg = Number.parseFloat(cols[1] ?? '');
      if (Number.isFinite(kg) && kg >= 25 && kg <= 250) {
        summary.weights.push({
          weightKg: Number(kg.toFixed(2)),
          recordedAt: cols[2] ? new Date(cols[2]).toISOString() : new Date().toISOString(),
        });
      }
      continue;
    }
    if (cols.length >= 2) {
      const name = cols[0] ?? '';
      const reps = Number.parseInt(cols[1] ?? '12', 10);
      const kg = cols[2] ? Number.parseFloat(cols[2]) : null;
      const kcal = cols[3] ? Number.parseInt(cols[3], 10) : null;
      const hr = cols[4] ? Number.parseInt(cols[4], 10) : null;
      if (name && Number.isFinite(reps) && reps > 0) {
        summary.workouts.push({
          id: `csv-${summary.workouts.length + 1}`,
          exercise: name.startsWith('Keep') ? name : `Keep · ${name}`,
          reps,
          weightKg: kg !== null && Number.isFinite(kg) && kg > 0 ? kg : null,
          durationMinutes: reps,
          caloriesKcal: kcal !== null && Number.isFinite(kcal) ? kcal : null,
          avgHeartRateBpm: hr !== null && Number.isFinite(hr) ? hr : null,
          recordedAt: new Date().toISOString(),
        });
      }
    }
  }

  return summary;
}
