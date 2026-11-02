export type WearableSourceId =
  | 'ble-scale'
  | 'ble-hr'
  | 'keep'
  | 'apple-health'
  | 'health-connect'
  | 'intervals-icu'
  | 'strava';

export type WearableAuthGrant = {
  provider: WearableSourceId;
  title: string;
  subtitle: string;
  authorized: boolean;
  autoSyncOnLaunch: boolean;
  scopes: readonly string[];
  athleteId?: string;
  apiKey?: string;
  accessToken?: string;
  lastSyncedAt: string | null;
};

export type WearableTelemetry = {
  source: WearableSourceId;
  deviceName: string;
  latestWeightKg: number | null;
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

export const DEFAULT_WEARABLE_GRANTS: readonly WearableAuthGrant[] = [
  {
    provider: 'apple-health',
    title: 'Apple HealthKit（iOS 原生健康 · 自动同步体脂秤体重与 Keep 训练）',
    subtitle: '授权读取 HKQuantityTypeBodyMass（体重）、心率、步数、动态千卡与训练，打开 App 自动入账',
    authorized: false,
    autoSyncOnLaunch: true,
    scopes: ['体重 (BodyMass)', '实时心率 (HeartRate)', '动态千卡 (ActiveEnergy)', '步数 (Steps)', '训练 (Workouts)'],
    lastSyncedAt: null,
  },
  {
    provider: 'health-connect',
    title: 'Android Health Connect（系统健康 · 自动同步 Keep/小米/华为体脂秤）',
    subtitle: '授权读取系统健康中心的智能秤体重、手环心率与运动消耗，启动即自动同步',
    authorized: false,
    autoSyncOnLaunch: true,
    scopes: ['WeightRecord (体重)', 'HeartRateRecord (心率)', 'ActiveCaloriesBurned', 'StepsRecord', 'ExerciseSession'],
    lastSyncedAt: null,
  },
  {
    provider: 'ble-scale',
    title: '蓝牙智能体脂秤（BLE 0x181D Weight Scale / 0x181B Body Composition）',
    subtitle: '上秤即连：支持 Keep 体脂秤、小米体脂秤、华为/香山等标准 BLE 广播秤，稳定后自动写入今日晨重',
    authorized: false,
    autoSyncOnLaunch: true,
    scopes: ['GATT 0x181D Weight Scale', 'GATT 0x2A9D Weight Measurement', 'GATT 0x181B Body Composition'],
    lastSyncedAt: null,
  },
  {
    provider: 'ble-hr',
    title: 'Keep 手环 / 运动手表（BLE 0x180D 心率广播）',
    subtitle: '实时接收每秒运动心率并计算 Z1–Z5 燃脂区间，训练结束自动汇总时长与卡路里',
    authorized: false,
    autoSyncOnLaunch: false,
    scopes: ['GATT 0x180D Heart Rate', 'GATT 0x2A37 Heart Rate Measurement'],
    lastSyncedAt: null,
  },
  {
    provider: 'intervals-icu',
    title: 'Intervals.icu / Strava 跨端云桥接（Mac / 手机 / 手表全自动云同步）',
    subtitle: '填入 Athlete ID 与 API Key 后，每次打开自动拉取云端最新称重（Wellness Weight）与运动记录',
    authorized: false,
    autoSyncOnLaunch: true,
    scopes: ['WELLNESS:READ (每日体重/静息心率)', 'ACTIVITY:READ (训练/千卡/心率曲线)'],
    lastSyncedAt: null,
  },
] as const;

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
 * Parses Bluetooth Low Energy (BLE) Smart Scale Weight Measurement frames:
 * 1. Standard GATT Weight Measurement (`0x2A9D`):
 *    - `flags = bytes[0]`
 *    - `isImperial = (flags & 0x01) === 1`
 *    - `raw = uint16LE(bytes[1], bytes[2])`
 *    - SI resolution is `0.005 kg` (`raw * 0.005`), Imperial resolution is `0.01 lb` (`raw * 0.01 * 0.45359237`).
 *    - Also supports Xiaomi Mi Scale / Keep Scale custom resolution (`0.005 kg` or `0.01 jin / 2`).
 * 2. Standard GATT Body Composition Measurement (`0x2A9C`):
 *    - If weight is included in flags or bytes[1..2], normalizes to `kg` rounded to 2 decimal places.
 */
export function parseBleWeightScaleMeasurement(bytes: readonly number[]): {
  weightKg: number;
  stabilized: boolean;
} | null {
  if (bytes.length < 3) return null;
  const flags = bytes[0] ?? 0;
  const isImperial = (flags & 0x01) === 1;
  const isCattyOrJin = (flags & 0x10) !== 0;
  // Bit 5 in Mi Scale / Keep Scale indicates stabilized measurement; standard 0x2A9D frames are emitted on stabilization
  const stabilized = (flags & 0x20) !== 0 || (flags & 0x80) === 0;
  const raw = (bytes[1] ?? 0) | ((bytes[2] ?? 0) << 8);
  if (raw <= 0 || raw === 0xffff) return null;

  let kg: number;
  if (isImperial) {
    kg = raw * 0.01 * 0.45359237;
  } else if (isCattyOrJin) {
    kg = (raw * 0.01) / 2;
  } else {
    kg = raw * 0.005;
    // Fallback if scale reports in 0.01 kg units (e.g. raw = 7240 -> 72.40 kg)
    if (kg < 25 && raw * 0.01 >= 25 && raw * 0.01 <= 250) {
      kg = raw * 0.01;
    }
  }

  if (!Number.isFinite(kg) || kg < 25 || kg > 250) return null;
  return {
    weightKg: Number(kg.toFixed(2)),
    stabilized,
  };
}

/**
 * Parses URL Deep Link / iOS Shortcuts auto-sync query string:
 * e.g. `?health_sync=1&weight=72.2&hr=142&kcal=510&steps=9200&workout=Keep%20HIIT&mins=25`
 */
export function parseHealthSyncUrlParams(search: string): HealthImportSummary | null {
  if (!search || !search.includes('health_sync=1')) return null;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (params.get('health_sync') !== '1') return null;

  const summary: HealthImportSummary = {
    weights: [],
    workouts: [],
    latestHeartRateBpm: null,
    stepsToday: null,
    activeCaloriesToday: null,
  };

  const nowIso = new Date().toISOString();
  const weightKg = Number.parseFloat(params.get('weight') ?? '');
  if (Number.isFinite(weightKg) && weightKg >= 25 && weightKg <= 250) {
    summary.weights.push({ weightKg: Number(weightKg.toFixed(2)), recordedAt: nowIso });
  }

  const hr = Number.parseInt(params.get('hr') ?? '', 10);
  if (Number.isFinite(hr) && hr >= 30 && hr <= 240) {
    summary.latestHeartRateBpm = hr;
  }

  const kcal = Number.parseInt(params.get('kcal') ?? '', 10);
  if (Number.isFinite(kcal) && kcal > 0) {
    summary.activeCaloriesToday = kcal;
  }

  const steps = Number.parseInt(params.get('steps') ?? '', 10);
  if (Number.isFinite(steps) && steps >= 0) {
    summary.stepsToday = steps;
  }

  const workout = (params.get('workout') ?? '').trim();
  if (workout) {
    const mins = Math.max(1, Number.parseInt(params.get('mins') ?? '25', 10) || 25);
    const loadKg = Number.parseFloat(params.get('load_kg') ?? '');
    summary.workouts.push({
      id: `deeplink-${Date.now()}`,
      exercise: workout.startsWith('Keep') ? workout : `Keep · ${workout}`,
      reps: mins,
      weightKg: Number.isFinite(loadKg) && loadKg > 0 ? loadKg : null,
      durationMinutes: mins,
      caloriesKcal: summary.activeCaloriesToday,
      avgHeartRateBpm: summary.latestHeartRateBpm,
      recordedAt: nowIso,
    });
  }

  return summary;
}

/**
 * Parses Keep / Apple Health / Xiaomi / Zepp / Garmin / Intervals.icu / Strava exported JSON or CSV text
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

  // 1. Try JSON format (Keep export / Apple Health Shortcut JSON / Intervals.icu / Strava / custom backup)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const items = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object'
          ? ((parsed as { records?: unknown[]; workouts?: unknown[]; activities?: unknown[]; data?: unknown[] }).records ??
            (parsed as { workouts?: unknown[] }).workouts ??
            (parsed as { activities?: unknown[] }).activities ??
            (parsed as { data?: unknown[] }).data ?? [parsed])
          : [];

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const root = parsed as Record<string, unknown>;
        if (typeof root.heartRateBpm === 'number') summary.latestHeartRateBpm = root.heartRateBpm;
        if (typeof root.restingHR === 'number' && !summary.latestHeartRateBpm) {
          summary.latestHeartRateBpm = root.restingHR;
        }
        if (typeof root.steps === 'number') summary.stepsToday = root.steps;
        if (typeof root.caloriesKcal === 'number') summary.activeCaloriesToday = root.caloriesKcal;
        if (typeof root.weightKg === 'number' && root.weightKg >= 25 && root.weightKg <= 250) {
          summary.weights.push({
            weightKg: Number(root.weightKg.toFixed(2)),
            recordedAt: String(root.recordedAt ?? root.syncedAt ?? new Date().toISOString()),
          });
        }
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
        if (Number.isFinite(weightVal) && weightVal >= 25 && weightVal <= 250 && !row.exercise && !row.workoutName && !row.type && !row.moving_time) {
          summary.weights.push({
            weightKg: Number(weightVal.toFixed(2)),
            recordedAt: String(row.recordedAt ?? row.startDate ?? row.id ?? row.date ?? new Date().toISOString()),
          });
          continue;
        }

        const exerciseName = String(
          row.exercise ?? row.workoutName ?? row.name ?? row.title ?? row.sportType ?? row.type ?? '',
        ).trim();
        if (exerciseName) {
          const durationMin = Math.max(
            1,
            Math.round(
              Number(
                row.durationMinutes ??
                  row.duration_min ??
                  Number(row.durationSeconds ?? row.moving_time ?? row.elapsed_time ?? 0) / 60,
              ) || 20,
            ),
          );
          const reps = Math.max(
            1,
            Math.round(Number(row.reps ?? row.count ?? durationMin)),
          );
          const loadKg = Number(row.weightKg ?? row.loadKg ?? row.resistanceKg);
          const kcal = Number(row.caloriesKcal ?? row.calories ?? row.kcal ?? (row.icu_joules ? Number(row.icu_joules) / 4184 : NaN));
          const hr = Number(row.avgHeartRateBpm ?? row.heartRate ?? row.avgHr ?? row.average_heartrate);
          if (Number.isFinite(hr) && hr > 30) summary.latestHeartRateBpm = Math.round(hr);
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
            recordedAt: String(row.recordedAt ?? row.startTime ?? row.start_date_local ?? row.date ?? new Date().toISOString()),
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
