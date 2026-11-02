import {
  type HealthImportSummary,
  parseBleHeartRateMeasurement,
  parseFitnessSyncPayload,
  type WearableTelemetry,
} from '@/core/wearable-sync';

const TELEMETRY_KEY = 'viastela.wearable.telemetry.v1';
const HR_HISTORY_KEY = 'viastela.wearable.hr_history.v1';

const DEFAULT_TELEMETRY: WearableTelemetry = {
  source: 'keep',
  deviceName: 'Keep 手环 / Apple Health',
  heartRateBpm: null,
  minHeartRateBpm: null,
  maxHeartRateBpm: null,
  activeCaloriesKcal: null,
  steps: null,
  workoutMinutes: null,
  updatedAt: new Date().toISOString(),
};

export function readWearableTelemetry(): WearableTelemetry {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_TELEMETRY;
    const raw = localStorage.getItem(TELEMETRY_KEY);
    if (!raw) return DEFAULT_TELEMETRY;
    const parsed = JSON.parse(raw) as Partial<WearableTelemetry>;
    return {
      ...DEFAULT_TELEMETRY,
      ...parsed,
    };
  } catch {
    return DEFAULT_TELEMETRY;
  }
}

export function writeWearableTelemetry(next: WearableTelemetry): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TELEMETRY_KEY, JSON.stringify(next));
    }
  } catch {
    // Ignore storage error
  }
}

export function readHeartRateSeries(): number[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(HR_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is number => typeof v === 'number' && v >= 30 && v <= 240);
  } catch {
    return [];
  }
}

export function appendHeartRateSample(bpm: number): number[] {
  const prev = readHeartRateSeries();
  const next = [...prev.slice(-29), bpm];
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(HR_HISTORY_KEY, JSON.stringify(next));
    }
  } catch {
    // Ignore storage error
  }
  return next;
}

export function isWebBluetoothSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return Boolean((navigator as unknown as { bluetooth?: { requestDevice?: unknown } }).bluetooth?.requestDevice);
}

/**
 * Connects directly to a Keep Band / Mi Band / Polar / Garmin / Coros wearable
 * broadcasting the standard BLE Heart Rate Service (`0x180D`) and Characteristic (`0x2A37`).
 */
export async function connectBleHeartRateMonitor(
  onHeartRate: (bpm: number, deviceName: string) => void,
): Promise<{ deviceName: string; disconnect: () => void }> {
  const nav = navigator as unknown as {
    bluetooth?: {
      requestDevice: (options: unknown) => Promise<{
        name?: string;
        gatt?: {
          connect: () => Promise<{
            disconnect: () => void;
            getPrimaryService: (uuid: string | number) => Promise<{
              getCharacteristic: (uuid: string | number) => Promise<{
                startNotifications: () => Promise<void>;
                addEventListener: (
                  type: string,
                  listener: (event: { target?: { value?: DataView } }) => void,
                ) => void;
              }>;
            }>;
          }>;
        };
      }>;
    };
  };

  if (!nav.bluetooth?.requestDevice) {
    throw new Error('当前运行环境暂未开启 Web Bluetooth 蓝牙直连，可使用「Keep / 健康快照导入」或心率模拟流');
  }

  const device = await nav.bluetooth.requestDevice({
    filters: [{ services: ['heart_rate'] }, { services: [0x180d] }],
    optionalServices: ['battery_service', 0x180f],
  });

  const deviceName = device.name || 'Keep 蓝牙心率手环';
  if (!device.gatt) {
    throw new Error('所选设备不支持 GATT 心率广播（请在 Keep 手环/手表开启「心率广播」模式）');
  }

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService('heart_rate');
  const characteristic = await service.getCharacteristic('heart_rate_measurement');
  await characteristic.startNotifications();

  characteristic.addEventListener('characteristicvaluechanged', (event) => {
    const view = event.target?.value;
    if (!view) return;
    const bytes: number[] = [];
    for (let i = 0; i < view.byteLength; i += 1) {
      bytes.push(view.getUint8(i));
    }
    const bpm = parseBleHeartRateMeasurement(bytes);
    if (bpm !== null) {
      onHeartRate(bpm, deviceName);
    }
  });

  return {
    deviceName,
    disconnect: () => {
      try {
        server.disconnect();
      } catch {
        // Ignore disconnect error
      }
    },
  };
}

/**
 * Generates a realistic Keep Band / Apple Watch workout & health sync snapshot
 * for 1-click experience or when testing without a physical band nearby.
 */
export function buildSampleKeepSyncPayload(currentWeightKg = 72.4): string {
  const now = new Date();
  return JSON.stringify(
    {
      device: 'Keep 手环 B4 / Apple Health',
      syncedAt: now.toISOString(),
      heartRateBpm: 138,
      steps: 9420,
      caloriesKcal: 585,
      weights: [
        {
          weightKg: Number((currentWeightKg - 0.1).toFixed(1)),
          recordedAt: now.toISOString(),
        },
      ],
      workouts: [
        {
          exercise: 'Keep 手环 · 燃脂 HIIT 核心训练',
          reps: 25,
          durationMinutes: 25,
          caloriesKcal: 310,
          avgHeartRateBpm: 146,
          recordedAt: now.toISOString(),
        },
        {
          exercise: 'Keep 哑铃上斜卧推',
          reps: 12,
          weightKg: 30,
          durationMinutes: 15,
          caloriesKcal: 145,
          avgHeartRateBpm: 132,
          recordedAt: now.toISOString(),
        },
      ],
    },
    null,
    2,
  );
}

export function importFitnessDataAndUpdateTelemetry(rawText: string): {
  summary: HealthImportSummary;
  telemetry: WearableTelemetry;
  hrSeries: number[];
} {
  const summary = parseFitnessSyncPayload(rawText);
  const current = readWearableTelemetry();
  const nextBpm = summary.latestHeartRateBpm ?? current.heartRateBpm ?? 134;
  const hrSeries = appendHeartRateSample(nextBpm);
  const minHr = hrSeries.length > 0 ? Math.min(...hrSeries) : nextBpm;
  const maxHr = hrSeries.length > 0 ? Math.max(...hrSeries) : nextBpm;
  const totalWorkoutMin = summary.workouts.reduce((sum, w) => sum + w.durationMinutes, 0);

  const telemetry: WearableTelemetry = {
    source: 'keep',
    deviceName: 'Keep 手环 / Apple Health',
    heartRateBpm: nextBpm,
    minHeartRateBpm: minHr,
    maxHeartRateBpm: maxHr,
    activeCaloriesKcal: summary.activeCaloriesToday ?? current.activeCaloriesKcal ?? 460,
    steps: summary.stepsToday ?? current.steps ?? 8420,
    workoutMinutes: totalWorkoutMin > 0 ? totalWorkoutMin : (current.workoutMinutes ?? 35),
    updatedAt: new Date().toISOString(),
  };

  writeWearableTelemetry(telemetry);
  return { summary, telemetry, hrSeries };
}
