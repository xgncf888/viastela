import {
  DEFAULT_WEARABLE_GRANTS,
  type HealthImportSummary,
  parseBleHeartRateMeasurement,
  parseBleWeightScaleMeasurement,
  parseFitnessSyncPayload,
  parseHealthSyncUrlParams,
  type WearableAuthGrant,
  type WearableSourceId,
  type WearableTelemetry,
} from '@/core/wearable-sync';

const TELEMETRY_KEY = 'viastela.wearable.telemetry.v1';
const HR_HISTORY_KEY = 'viastela.wearable.hr_history.v1';
const GRANTS_KEY = 'viastela.wearable.grants.v1';
const LAST_AUTOSYNC_DAY_KEY = 'viastela.wearable.autosync_day.v1';

const DEFAULT_TELEMETRY: WearableTelemetry = {
  source: 'keep',
  deviceName: '未连接设备',
  latestWeightKg: null,
  heartRateBpm: null,
  minHeartRateBpm: null,
  maxHeartRateBpm: null,
  activeCaloriesKcal: null,
  steps: null,
  workoutMinutes: null,
  updatedAt: '',
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

export function clearWearableTelemetry(): WearableTelemetry {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TELEMETRY_KEY);
      localStorage.removeItem(HR_HISTORY_KEY);
    }
  } catch {
    // Ignore storage error
  }
  return DEFAULT_TELEMETRY;
}

export function readWearableGrants(): WearableAuthGrant[] {
  try {
    if (typeof localStorage === 'undefined') return [...DEFAULT_WEARABLE_GRANTS];
    const raw = localStorage.getItem(GRANTS_KEY);
    if (!raw) return [...DEFAULT_WEARABLE_GRANTS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_WEARABLE_GRANTS];
    const byId = new Map<string, Partial<WearableAuthGrant>>();
    for (const item of parsed) {
      if (item && typeof item === 'object' && typeof item.provider === 'string') {
        byId.set(item.provider, item as Partial<WearableAuthGrant>);
      }
    }
    return DEFAULT_WEARABLE_GRANTS.map((def) => {
      const saved = byId.get(def.provider);
      if (!saved) return def;
      return {
        ...def,
        authorized: Boolean(saved.authorized),
        autoSyncOnLaunch:
          typeof saved.autoSyncOnLaunch === 'boolean' ? saved.autoSyncOnLaunch : def.autoSyncOnLaunch,
        athleteId: saved.athleteId ?? def.athleteId,
        apiKey: saved.apiKey ?? def.apiKey,
        accessToken: saved.accessToken ?? def.accessToken,
        lastSyncedAt: saved.lastSyncedAt ?? null,
      };
    });
  } catch {
    return [...DEFAULT_WEARABLE_GRANTS];
  }
}

export function writeWearableGrants(grants: readonly WearableAuthGrant[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GRANTS_KEY, JSON.stringify(grants));
    }
  } catch {
    // Ignore storage error
  }
}

export function updateWearableGrant(
  provider: WearableSourceId,
  patch: Partial<WearableAuthGrant>,
): WearableAuthGrant[] {
  const current = readWearableGrants();
  const next = current.map((item) => (item.provider === provider ? { ...item, ...patch } : item));
  writeWearableGrants(next);
  return next;
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

export function isNativeCoreBluetoothShell(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  const proto = window.location.protocol || '';
  return proto === 'app:' || proto === 'viastela-local:';
}

export type NativeBleStatus = {
  bleState: string;
  deviceName: string;
  weightKg?: number;
  weightStabilized?: boolean;
  heartRateBpm?: number;
  updatedAt: string;
};

/**
 * Starts or polls the real macOS/iOS CoreBluetooth `CBCentralManager` hardware scanner (`/__ble__/scan?action=start|status|stop`).
 * Never fabricates numbers—returns real hardware state (`scanning`, `connected`, `poweredOff`, `unauthorized`) and real GATT frames.
 */
export async function pollNativeCoreBluetooth(
  action: 'start' | 'status' | 'stop' = 'status',
): Promise<NativeBleStatus | null> {
  if (!isNativeCoreBluetoothShell()) return null;
  try {
    const res = await fetch(`/__ble__/scan?action=${action}&_t=${Date.now()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as NativeBleStatus;
    return data;
  } catch {
    return null;
  }
}

/**
 * Connects directly to a Smart Weight Scale (Keep Scale / Xiaomi Mi Scale / Huawei / standard BLE 0x181D / 0x181B)
 * via Web Bluetooth or native CoreBluetooth. Does NOT fabricate fake readings if no scale is connected.
 */
export async function connectBleWeightScale(
  onWeightMeasurement: (reading: { weightKg: number; stabilized: boolean; deviceName: string }) => void,
): Promise<{ mode: 'web-ble' | 'core-bluetooth'; deviceName: string; disconnect: () => void }> {
  if (isNativeCoreBluetoothShell()) {
    const initial = await pollNativeCoreBluetooth('start');
    if (initial?.bleState === 'poweredOff') {
      throw new Error('系统蓝牙当前处于关闭状态，请在 macOS 控制中心开启蓝牙后再踏上体脂秤');
    }
    if (initial?.bleState === 'unauthorized') {
      throw new Error('请在「系统设置 → 隐私与安全性 → 蓝牙」中允许本应用访问蓝牙');
    }
    const timer = setInterval(() => {
      void pollNativeCoreBluetooth('status').then((st) => {
        if (!st) return;
        if (typeof st.weightKg === 'number' && st.weightKg > 0) {
          onWeightMeasurement({
            weightKg: st.weightKg,
            stabilized: Boolean(st.weightStabilized),
            deviceName: st.deviceName || '蓝牙智能体脂秤',
          });
        }
      });
    }, 1000);
    return {
      mode: 'core-bluetooth',
      deviceName: initial?.deviceName || '正在扫描附近 BLE 体脂秤 (0x181D / 0x181B)…',
      disconnect: () => {
        clearInterval(timer);
        void pollNativeCoreBluetooth('stop');
      },
    };
  }

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
    throw new Error('当前浏览器不支持 Web Bluetooth（请使用 macOS 桌面客户端或 Chrome/Edge 连接蓝牙体脂秤）');
  }

  const device = await nav.bluetooth.requestDevice({
    filters: [
      { services: ['weight_scale'] },
      { services: [0x181d] },
      { services: ['body_composition'] },
      { services: [0x181b] },
    ],
    optionalServices: ['weight_scale', 0x181d, 'body_composition', 0x181b, 'battery_service', 0x180f],
  });

  const deviceName = device.name || '智能蓝牙体脂秤';
  if (!device.gatt) {
    throw new Error('所选体脂秤不支持标准 GATT 广播');
  }

  const server = await device.gatt.connect();
  let characteristic: {
    startNotifications: () => Promise<void>;
    addEventListener: (
      type: string,
      listener: (event: { target?: { value?: DataView } }) => void,
    ) => void;
  };

  try {
    const service = await server.getPrimaryService(0x181d);
    characteristic = await service.getCharacteristic(0x2a9d);
  } catch {
    const service = await server.getPrimaryService(0x181b);
    characteristic = await service.getCharacteristic(0x2a9c);
  }

  await characteristic.startNotifications();
  characteristic.addEventListener('characteristicvaluechanged', (event) => {
    const view = event.target?.value;
    if (!view) return;
    const bytes: number[] = [];
    for (let i = 0; i < view.byteLength; i += 1) {
      bytes.push(view.getUint8(i));
    }
    const parsed = parseBleWeightScaleMeasurement(bytes);
    if (parsed) {
      onWeightMeasurement({
        weightKg: parsed.weightKg,
        stabilized: parsed.stabilized,
        deviceName,
      });
    }
  });

  updateWearableGrant('ble-scale', {
    authorized: true,
    lastSyncedAt: new Date().toISOString(),
  });

  return {
    mode: 'web-ble',
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
 * Connects directly to a Keep Band / Mi Band / Polar / Garmin / Coros wearable
 * broadcasting the standard BLE Heart Rate Service (`0x180D`) and Characteristic (`0x2A37`).
 * Never silently fabricates fake heart rate numbers.
 */
export async function connectBleHeartRateMonitor(
  onHeartRate: (bpm: number, deviceName: string) => void,
): Promise<{ mode: 'web-ble' | 'core-bluetooth'; deviceName: string; disconnect: () => void }> {
  if (isNativeCoreBluetoothShell()) {
    const initial = await pollNativeCoreBluetooth('start');
    if (initial?.bleState === 'poweredOff') {
      throw new Error('系统蓝牙当前处于关闭状态，请在 macOS 控制中心开启蓝牙');
    }
    if (initial?.bleState === 'unauthorized') {
      throw new Error('请在「系统设置 → 隐私与安全性 → 蓝牙」中允许本应用访问蓝牙');
    }
    const timer = setInterval(() => {
      void pollNativeCoreBluetooth('status').then((st) => {
        if (!st) return;
        if (typeof st.heartRateBpm === 'number' && st.heartRateBpm > 0) {
          onHeartRate(st.heartRateBpm, st.deviceName || 'Keep 蓝牙心率手环');
        }
      });
    }, 1000);
    return {
      mode: 'core-bluetooth',
      deviceName: initial?.deviceName || '正在扫描附近 BLE 心率手环 (0x180D)…',
      disconnect: () => {
        clearInterval(timer);
        void pollNativeCoreBluetooth('stop');
      },
    };
  }

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
    throw new Error('当前浏览器不支持 Web Bluetooth（请使用 macOS 桌面客户端或 Chrome/Edge 连接 Keep 手环）');
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

  updateWearableGrant('ble-hr', {
    authorized: true,
    lastSyncedAt: new Date().toISOString(),
  });

  return {
    mode: 'web-ble',
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
 * Fetches latest weight (`wellness`) and workouts (`activities`) from Intervals.icu Open API
 * using Basic Auth (`API_KEY:<apiKey>`).
 */
export async function syncIntervalsIcuCloud(
  athleteId: string,
  apiKey: string,
): Promise<HealthImportSummary> {
  const cleanId = athleteId.trim();
  const cleanKey = apiKey.trim();
  if (!cleanId || !cleanKey) {
    throw new Error('请填写 Intervals.icu 的 Athlete ID（如 i123456）和 API Key');
  }

  const now = new Date();
  const newest = now.toISOString().slice(0, 10);
  const oldest = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const authHeader = `Basic ${btoa(`API_KEY:${cleanKey}`)}`;

  const [wellnessRes, activitiesRes] = await Promise.all([
    fetch(`https://intervals.icu/api/v1/athlete/${encodeURIComponent(cleanId)}/wellness?oldest=${oldest}&newest=${newest}`, {
      headers: { Authorization: authHeader },
    }),
    fetch(`https://intervals.icu/api/v1/athlete/${encodeURIComponent(cleanId)}/activities?oldest=${oldest}&newest=${newest}`, {
      headers: { Authorization: authHeader },
    }),
  ]);

  if (!wellnessRes.ok && !activitiesRes.ok) {
    throw new Error('Intervals.icu 授权验证未通过，请检查 Athlete ID 与 API Key');
  }

  const summary: HealthImportSummary = {
    weights: [],
    workouts: [],
    latestHeartRateBpm: null,
    stepsToday: null,
    activeCaloriesToday: null,
  };

  if (wellnessRes.ok) {
    const wellnessRows = (await wellnessRes.json()) as Record<string, unknown>[];
    if (Array.isArray(wellnessRows)) {
      for (const row of wellnessRows) {
        const kg = Number(row.weight);
        if (Number.isFinite(kg) && kg >= 25 && kg <= 250) {
          summary.weights.push({
            weightKg: Number(kg.toFixed(2)),
            recordedAt: String(row.id ?? newest),
          });
        }
        const rhr = Number(row.restingHR);
        if (Number.isFinite(rhr) && rhr >= 30 && rhr <= 220) {
          summary.latestHeartRateBpm = Math.round(rhr);
        }
        const steps = Number(row.steps);
        if (Number.isFinite(steps) && steps > 0) {
          summary.stepsToday = Math.round(steps);
        }
      }
    }
  }

  if (activitiesRes.ok) {
    const actRows = (await activitiesRes.json()) as unknown[];
    const parsedAct = parseFitnessSyncPayload(JSON.stringify(actRows));
    summary.workouts.push(...parsedAct.workouts);
    if (parsedAct.latestHeartRateBpm) summary.latestHeartRateBpm = parsedAct.latestHeartRateBpm;
    if (parsedAct.activeCaloriesToday) summary.activeCaloriesToday = parsedAct.activeCaloriesToday;
  }

  updateWearableGrant('intervals-icu', {
    authorized: true,
    athleteId: cleanId,
    apiKey: cleanKey,
    lastSyncedAt: new Date().toISOString(),
  });

  return summary;
}

export function applyHealthSummaryToTelemetry(
  summary: HealthImportSummary,
  source: WearableSourceId = 'keep',
  deviceName = '已同步设备',
): {
  summary: HealthImportSummary;
  telemetry: WearableTelemetry;
  hrSeries: number[];
} {
  const current = readWearableTelemetry();
  const nextBpm = summary.latestHeartRateBpm ?? current.heartRateBpm;
  const hrSeries = nextBpm !== null ? appendHeartRateSample(nextBpm) : readHeartRateSeries();
  const minHr = hrSeries.length > 0 ? Math.min(...hrSeries) : nextBpm;
  const maxHr = hrSeries.length > 0 ? Math.max(...hrSeries) : nextBpm;
  const totalWorkoutMin = summary.workouts.reduce((sum, w) => sum + w.durationMinutes, 0);
  const latestWeight =
    summary.weights.length > 0
      ? summary.weights[summary.weights.length - 1]!.weightKg
      : current.latestWeightKg;

  const telemetry: WearableTelemetry = {
    source,
    deviceName,
    latestWeightKg: latestWeight,
    heartRateBpm: nextBpm,
    minHeartRateBpm: minHr,
    maxHeartRateBpm: maxHr,
    activeCaloriesKcal: summary.activeCaloriesToday ?? current.activeCaloriesKcal,
    steps: summary.stepsToday ?? current.steps,
    workoutMinutes: totalWorkoutMin > 0 ? totalWorkoutMin : current.workoutMinutes,
    updatedAt: new Date().toISOString(),
  };

  writeWearableTelemetry(telemetry);
  return { summary, telemetry, hrSeries };
}

export function importFitnessDataAndUpdateTelemetry(rawText: string): {
  summary: HealthImportSummary;
  telemetry: WearableTelemetry;
  hrSeries: number[];
} {
  const summary = parseFitnessSyncPayload(rawText);
  return applyHealthSummaryToTelemetry(summary, 'keep', '手动导入 / 快捷指令同步');
}

/**
 * Checks if the URL contains `?health_sync=1&weight=...` (from iOS Shortcuts / Android automation).
 */
export function checkLaunchUrlHealthSync(): HealthImportSummary | null {
  if (typeof window === 'undefined' || !window.location?.search) return null;
  const parsed = parseHealthSyncUrlParams(window.location.search);
  if (!parsed) return null;
  try {
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history?.replaceState?.({}, '', cleanUrl);
  } catch {
    // Ignore history replace error
  }
  return parsed;
}

export function hasAutoSyncedToday(localDay: string): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(LAST_AUTOSYNC_DAY_KEY) === localDay;
  } catch {
    return false;
  }
}

export function markAutoSyncedToday(localDay: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LAST_AUTOSYNC_DAY_KEY, localDay);
    }
  } catch {
    // Ignore storage error
  }
}
