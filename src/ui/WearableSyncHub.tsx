import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, View } from 'react-native';

import { buildSparklineSvgPath } from '@/core/market-pulse';
import {
  classifyHeartRateZone,
  type HealthImportSummary,
  type WearableAuthGrant,
  type WearableSourceId,
  type WearableTelemetry,
} from '@/core/wearable-sync';
import {
  appendHeartRateSample,
  applyHealthSummaryToTelemetry,
  checkLaunchUrlHealthSync,
  clearWearableTelemetry,
  connectBleHeartRateMonitor,
  connectBleWeightScale,
  hasAutoSyncedToday,
  importFitnessDataAndUpdateTelemetry,
  markAutoSyncedToday,
  readHeartRateSeries,
  readWearableGrants,
  readWearableTelemetry,
  syncIntervalsIcuCloud,
  writeWearableTelemetry,
} from '@/data/wearable-sync';

import { useI18n } from './use-i18n';

import { Button } from './Button';
import { Card, cardSurfaceStyle } from './Card';
import { Divider, Row, Stack } from './layout';
import { Text } from './Text';
import { TextField } from './TextField';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { showToast } from './toast';
import { CockpitPillButton, TagChip } from './WorkbenchConsole';

export function WearableSyncHub({
  latestWeightKg,
  localDay,
  onSyncWorkoutSet,
  onSyncWeightKg,
}: {
  latestWeightKg?: number;
  localDay?: string;
  onSyncWorkoutSet?: (input: {
    exercise: string;
    reps: number;
    weightKg: number | null;
    bandLevel: string | null;
  }) => Promise<unknown>;
  onSyncWeightKg?: (weightKg: number) => Promise<unknown>;
}) {
  const { color } = useTheme();
  const { t } = useI18n();
  const [telemetry, setTelemetry] = useState<WearableTelemetry>(readWearableTelemetry);
  const [grants, setGrants] = useState<WearableAuthGrant[]>(readWearableGrants);
  const [hrSeries, setHrSeries] = useState<number[]>(readHeartRateSeries);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [bleHrScanning, setBleHrScanning] = useState(false);
  const [bleScaleScanning, setBleScaleScanning] = useState(false);
  const [liveScaleKg, setLiveScaleKg] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [authCenterOpen, setAuthCenterOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importPayload, setImportPayload] = useState('');
  const [intervalsAthleteId, setIntervalsAthleteId] = useState(
    () => readWearableGrants().find((g) => g.provider === 'intervals-icu')?.athleteId ?? '',
  );
  const [intervalsApiKey, setIntervalsApiKey] = useState(
    () => readWearableGrants().find((g) => g.provider === 'intervals-icu')?.apiKey ?? '',
  );
  const [syncingProvider, setSyncingProvider] = useState<WearableSourceId | null>(null);

  const disconnectBleHrRef = useRef<(() => void) | null>(null);
  const disconnectBleScaleRef = useRef<(() => void) | null>(null);
  const lastSavedScaleKgRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      disconnectBleHrRef.current?.();
      disconnectBleScaleRef.current?.();
    };
  }, []);

  const commitSummaryToLedger = useCallback(
    async (
      summary: HealthImportSummary,
      source: WearableSourceId,
      deviceName: string,
      silent = false,
    ) => {
      const { telemetry: nextTel, hrSeries: nextHr } = applyHealthSummaryToTelemetry(
        summary,
        source,
        deviceName,
      );
      setTelemetry(nextTel);
      setHrSeries(nextHr);

      let syncedSets = 0;
      if (onSyncWorkoutSet && summary.workouts.length > 0) {
        for (const workout of summary.workouts) {
          await onSyncWorkoutSet({
            exercise: workout.exercise,
            reps: workout.reps,
            weightKg: workout.weightKg,
            bandLevel: null,
          });
          syncedSets += 1;
        }
      }

      let syncedWeightVal: number | null = null;
      if (onSyncWeightKg && summary.weights.length > 0) {
        const latest = summary.weights[summary.weights.length - 1];
        if (latest) {
          await onSyncWeightKg(latest.weightKg);
          syncedWeightVal = latest.weightKg;
        }
      }

      setGrants(readWearableGrants());
      if (!silent) {
        const parts: string[] = [];
        if (syncedWeightVal !== null) parts.push(`体重 ${syncedWeightVal.toFixed(1)} kg 已自动入账`);
        if (syncedSets > 0) parts.push(`训练 ${syncedSets} 项已入账`);
        showToast({
          text:
            parts.length > 0
              ? `${deviceName}：${parts.join(' · ')}`
              : `已同步 ${deviceName} 健康数据`,
        });
      }
    },
    [onSyncWeightKg, onSyncWorkoutSet],
  );

  // 1. Check URL Deep Link auto-sync (`?health_sync=1&weight=72.2&hr=142...`) on mount
  useEffect(() => {
    const urlSync = checkLaunchUrlHealthSync();
    if (urlSync) {
      const timer = setTimeout(() => {
        void commitSummaryToLedger(urlSync, 'apple-health', 'Apple Health / 快捷指令同步', false);
      }, 0);
      return () => clearTimeout(timer);
    }
    // 2. Only auto-sync on launch if user has explicitly configured Intervals.icu cloud credentials
    if (!localDay || hasAutoSyncedToday(localDay)) return;
    const cloudGrant = readWearableGrants().find(
      (g) => g.provider === 'intervals-icu' && g.authorized && g.athleteId && g.apiKey,
    );
    if (!cloudGrant || !cloudGrant.athleteId || !cloudGrant.apiKey) return;

    markAutoSyncedToday(localDay);
    void syncIntervalsIcuCloud(cloudGrant.athleteId, cloudGrant.apiKey)
      .then((summary) =>
        commitSummaryToLedger(summary, 'intervals-icu', 'Intervals.icu 云端自动同步', false),
      )
      .catch(() => undefined);
  }, [commitSummaryToLedger, localDay]);

  async function onConnectBleScale() {
    if (bleScaleScanning) {
      disconnectBleScaleRef.current?.();
      disconnectBleScaleRef.current = null;
      setBleScaleScanning(false);
      setStatusMessage(null);
      showToast({ text: '已停止蓝牙体脂秤扫描' });
      return;
    }
    setStatusMessage('正在通过蓝牙扫描附近 BLE 体脂秤 (GATT 0x181D / 0x181B)，请亮屏并站上体脂秤…');
    try {
      const conn = await connectBleWeightScale((reading) => {
        setLiveScaleKg(reading.weightKg);
        setStatusMessage(
          reading.stabilized
            ? `已锁定真实称重 ${reading.weightKg.toFixed(2)} kg（来自 ${reading.deviceName}），已自动写入今日晨重`
            : `正在接收 ${reading.deviceName} 实时读数：${reading.weightKg.toFixed(2)} kg（等待数值稳定锁定…）`,
        );
        if (reading.stabilized && lastSavedScaleKgRef.current !== reading.weightKg) {
          lastSavedScaleKgRef.current = reading.weightKg;
          void commitSummaryToLedger(
            {
              weights: [{ weightKg: reading.weightKg, recordedAt: new Date().toISOString() }],
              workouts: [],
              latestHeartRateBpm: null,
              stepsToday: null,
              activeCaloriesToday: null,
            },
            'ble-scale',
            reading.deviceName,
            false,
          );
        }
      });
      disconnectBleScaleRef.current = conn.disconnect;
      setBleScaleScanning(true);
      setGrants(readWearableGrants());
      showToast({ text: conn.deviceName });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未检测到蓝牙体脂秤';
      setStatusMessage(msg);
      showToast({ text: msg, tone: 'error' });
    }
  }

  async function onConnectBleBand() {
    if (bleHrScanning) {
      disconnectBleHrRef.current?.();
      disconnectBleHrRef.current = null;
      setBleHrScanning(false);
      setStatusMessage(null);
      showToast({ text: '已断开蓝牙心率手环' });
      return;
    }
    setStatusMessage('正在通过蓝牙扫描 Keep 手环 / 运动手表 (GATT 0x180D)，请在手环上开启「心率广播」…');
    try {
      const conn = await connectBleHeartRateMonitor((bpm, deviceName) => {
        const nextSeries = appendHeartRateSample(bpm);
        setHrSeries(nextSeries);
        setStatusMessage(`已连接 ${deviceName} · 实时心率 ${bpm} BPM`);
        setTelemetry((prev) => {
          const updated: WearableTelemetry = {
            ...prev,
            source: 'ble-hr',
            deviceName,
            heartRateBpm: bpm,
            minHeartRateBpm: Math.min(...nextSeries),
            maxHeartRateBpm: Math.max(...nextSeries),
            updatedAt: new Date().toISOString(),
          };
          writeWearableTelemetry(updated);
          return updated;
        });
      });
      disconnectBleHrRef.current = conn.disconnect;
      setBleHrScanning(true);
      setGrants(readWearableGrants());
      showToast({ text: conn.deviceName });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未检测到开启心率广播的蓝牙手环';
      setStatusMessage(msg);
      showToast({ text: msg, tone: 'error' });
    }
  }

  async function onAuthorizeIntervalsCloud() {
    setSyncingProvider('intervals-icu');
    try {
      const summary = await syncIntervalsIcuCloud(intervalsAthleteId, intervalsApiKey);
      await commitSummaryToLedger(summary, 'intervals-icu', 'Intervals.icu 云端同步', false);
      setStatusMessage('已从 Intervals.icu 同步真实体重与运动记录');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Intervals.icu 同步失败';
      setStatusMessage(msg);
      showToast({ text: msg, tone: 'error' });
    } finally {
      setSyncingProvider(null);
    }
  }

  async function onCopyIosShortcutUrl() {
    const url = 'https://xgncf888.github.io/viastela/?health_sync=1&weight={最新体重}&hr={心率}&kcal={活动能量}&steps={步数}&workout=Keep训练&mins=25';
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      showToast({ text: '已复制 iOS「苹果健康 / Keep 自动同步」快捷指令 URL 模板' });
      return;
    }
    try {
      await Share.share({ message: url });
    } catch {
      showToast({ text: url });
    }
  }

  async function onRunImport(rawText: string) {
    const clean = rawText.trim();
    if (!clean) {
      showToast({ text: '请先粘贴真实的 Keep / Apple Health JSON 或 CSV 数据', tone: 'error' });
      return;
    }
    const { summary } = importFitnessDataAndUpdateTelemetry(clean);
    if (
      summary.weights.length === 0 &&
      summary.workouts.length === 0 &&
      summary.latestHeartRateBpm === null
    ) {
      showToast({ text: '未解析到有效的体重、心率或训练字段，请检查格式', tone: 'error' });
      return;
    }
    await commitSummaryToLedger(summary, 'keep', '手动导入 / 快捷指令同步', false);
    setImportOpen(false);
    setImportPayload('');
  }

  function onResetCachedTelemetry() {
    const empty = clearWearableTelemetry();
    setTelemetry(empty);
    setHrSeries([]);
    setLiveScaleKg(null);
    setStatusMessage('已清空之前的本地演示缓存数据，当前仅显示真实硬件/云端同步数据');
    showToast({ text: '已清除演示缓存数据' });
  }

  const authorizedCount = grants.filter((g) => g.authorized).length;
  const activeBpm =
    hoverIdx !== null && hrSeries[hoverIdx] !== undefined
      ? hrSeries[hoverIdx]!
      : telemetry.heartRateBpm;
  const zone = activeBpm !== null ? classifyHeartRateZone(activeBpm) : null;
  const { linePath, areaPath } = buildSparklineSvgPath(hrSeries, 220, 44);
  const scaleWeightToShow = liveScaleKg ?? telemetry.latestWeightKg;

  return (
    <Card>
      <Stack gap="sm">
        <Row justify="between" align="center" gap="sm" wrap>
          <Row gap="sm" align="center" wrap>
            <Text variant="heading">
              {t('硬件体脂秤与 Keep 手环连接台（真实蓝牙 / 云端桥接）', 'Smart Scale & Wearable BLE / Cloud Sync Hub')}
            </Text>
            <TagChip
              label={
                bleScaleScanning || bleHrScanning
                  ? t('BLE SCANNING · 正在扫描真实硬件…', 'BLE SCANNING…')
                  : activeBpm !== null && zone
                    ? `CONNECTED · ${zone.label} ${activeBpm} BPM`
                    : scaleWeightToShow !== null
                      ? `SCALE SYNCED · ${scaleWeightToShow.toFixed(1)} kg`
                      : t('STANDBY · 未连接硬件', 'STANDBY · Ready')
              }
              tone={
                bleScaleScanning || bleHrScanning || activeBpm !== null || scaleWeightToShow !== null
                  ? 'exec'
                  : 'neutral'
              }
            />
          </Row>
          <Row gap="xs" align="center" wrap>
            <CockpitPillButton
              label={bleScaleScanning ? t('停止扫描体脂秤', 'Stop Scale Scan') : t('扫描蓝牙体脂秤 (BLE)', 'Scan BLE Scale')}
              variant="accent"
              accessibilityLabel="通过原生 CoreBluetooth 或 Web Bluetooth 扫描附近智能体脂秤"
              onPress={() => void onConnectBleScale()}
            />
            <CockpitPillButton
              label={bleHrScanning ? t('断开手环心率', 'Disconnect Band') : t('扫描 Keep 心率手环 (BLE)', 'Scan BLE Heart Band')}
              accessibilityLabel="通过蓝牙 BLE 扫描 Keep 手环或运动手表心率广播"
              onPress={() => void onConnectBleBand()}
            />
            <CockpitPillButton
              label={t(`云端与自动化配置 (${authorizedCount})`, `Cloud & Shortcuts (${authorizedCount})`)}
              accessibilityLabel="打开 Intervals.icu 云端与 iOS 快捷指令配置"
              onPress={() => setAuthCenterOpen((prev) => !prev)}
            />
            <CockpitPillButton
              label={t('JSON/CSV 导入', 'Import JSON/CSV')}
              accessibilityLabel="导入 Keep 或 Apple Health 数据"
              onPress={() => setImportOpen((prev) => !prev)}
            />
            {telemetry.heartRateBpm !== null || telemetry.latestWeightKg !== null ? (
              <CockpitPillButton
                label="清空缓存"
                accessibilityLabel="清空之前缓存的设备读数"
                onPress={onResetCachedTelemetry}
              />
            ) : null}
          </Row>
        </Row>

        {statusMessage ? (
          <View style={[styles.statusBanner, { backgroundColor: color.surface, borderColor: color.line }]}>
            <Text variant="caption" tone="ink">
              {statusMessage}
            </Text>
          </View>
        ) : null}

        <Divider />

        <View style={styles.metricsGrid}>
          {/* 1. Real BLE Smart Scale Card */}
          <View
            style={[
              styles.metricCard,
              cardSurfaceStyle(color.surface, color.line),
              { borderColor: bleScaleScanning ? color.accent : color.line },
            ]}
          >
            <Row justify="between" align="center">
              <Text variant="caption" tone="muted">
                蓝牙智能体脂秤 (BLE 0x181D / 0x181B)
              </Text>
              <TagChip
                label={
                  bleScaleScanning
                    ? '扫描广播中…'
                    : scaleWeightToShow !== null
                      ? '已同步'
                      : '未连接'
                }
                tone={bleScaleScanning ? 'owner' : scaleWeightToShow !== null ? 'exec' : 'neutral'}
              />
            </Row>
            <Text variant="heading" style={styles.bigMono}>
              {scaleWeightToShow !== null ? `${scaleWeightToShow.toFixed(2)} kg` : '未连接体脂秤'}
            </Text>
            <Text variant="caption" tone="muted">
              {bleScaleScanning
                ? '正在通过 Mac 原生 CoreBluetooth 监听附近体脂秤广播，请赤脚站上体脂秤…'
                : latestWeightKg
                  ? `当前台账晨重 ${latestWeightKg.toFixed(1)} kg · 点击上方「扫描蓝牙体脂秤」连接真实硬件`
                  : '点击上方「扫描蓝牙体脂秤」连接真实 BLE 体脂秤，数值稳定后自动入账'}
            </Text>
          </View>

          {/* 2. Real BLE Heart Rate Card */}
          <View
            style={[
              styles.metricCard,
              cardSurfaceStyle(color.surface, color.line),
              { borderColor: bleHrScanning ? color.accent : color.line },
            ]}
          >
            <Row justify="between" align="center">
              <Text variant="caption" tone="muted">
                Keep 手环实时心率 (BLE 0x180D)
              </Text>
              <TagChip
                label={zone ? zone.label : bleHrScanning ? '等待广播…' : '未连接'}
                tone={zone ? zone.tone : bleHrScanning ? 'owner' : 'neutral'}
              />
            </Row>
            <Row justify="between" align="center" gap="sm">
              <View style={{ flex: 1 }}>
                <Text variant="heading" style={styles.bigMono}>
                  {activeBpm !== null ? `${activeBpm} BPM` : '等待手环广播'}
                </Text>
                <Text variant="caption" tone="muted">
                  {activeBpm !== null && hrSeries.length > 0
                    ? `区间 ${Math.min(...hrSeries)}–${Math.max(...hrSeries)} BPM (${telemetry.deviceName})`
                    : '在 Keep 手环/手表开启「心率广播」后点击扫描连接'}
                </Text>
              </View>
              {hrSeries.length >= 2 ? (
                <View style={styles.hrChartWrap}>
                  {Platform.OS === 'web'
                    ? createElement(
                        'svg',
                        {
                          width: 130,
                          height: 36,
                          viewBox: '0 0 220 44',
                          fill: 'none',
                          'aria-hidden': true,
                        },
                        createElement('path', {
                          d: areaPath,
                          fill: 'rgba(204, 120, 92, 0.16)',
                        }),
                        createElement('path', {
                          d: linePath,
                          stroke: color.accent,
                          strokeWidth: 2,
                          strokeLinecap: 'round',
                          strokeLinejoin: 'round',
                        }),
                      )
                    : null}
                  <View style={styles.scrubOverlay}>
                    {hrSeries.map((pt, idx) => (
                      <Pressable
                        key={`hr-pt-${idx}`}
                        accessibilityRole="button"
                        accessibilityLabel={`心率采样点 ${idx + 1}: ${pt} BPM`}
                        onHoverIn={() => setHoverIdx(idx)}
                        onHoverOut={() => setHoverIdx(null)}
                        onPress={() => setHoverIdx(idx === hoverIdx ? null : idx)}
                        style={[
                          styles.scrubSlot,
                          hoverIdx === idx
                            ? { borderBottomWidth: 2, borderBottomColor: color.accent }
                            : null,
                        ]}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </Row>
          </View>

          {/* 3. Active Calories & Steps Card */}
          <View
            style={[
              styles.metricCard,
              cardSurfaceStyle(color.surface, color.line),
              { borderColor: color.line },
            ]}
          >
            <Row justify="between" align="center">
              <Text variant="caption" tone="muted">
                今日同步运动消耗 &amp; 步数
              </Text>
              <TagChip
                label={telemetry.activeCaloriesKcal !== null ? '已同步' : '待同步'}
                tone={telemetry.activeCaloriesKcal !== null ? 'exec' : 'neutral'}
              />
            </Row>
            <Text variant="heading" style={styles.bigMono}>
              {telemetry.activeCaloriesKcal !== null
                ? `${telemetry.activeCaloriesKcal} kcal`
                : '暂无同步数据'}
            </Text>
            <Text variant="caption" tone="muted">
              {telemetry.steps !== null || telemetry.workoutMinutes !== null
                ? `步数 ${(telemetry.steps ?? 0).toLocaleString('en-US')} 步 · 运动 ${telemetry.workoutMinutes ?? 0} 分钟`
                : '可通过 Intervals.icu 云端或 iOS「苹果健康」快捷指令自动传入'}
            </Text>
          </View>
        </View>

        {authCenterOpen ? (
          <View style={[styles.subPanel, { backgroundColor: color.surface, borderColor: color.line }]}>
            <Stack gap="sm">
              <Row justify="between" align="center" wrap>
                <Text variant="label">真实跨端自动同步配置（iOS 快捷指令自动化 &amp; Intervals.icu 云端）</Text>
                <CockpitPillButton
                  label="复制 iOS 自动化同步链接"
                  onPress={() => void onCopyIosShortcutUrl()}
                />
              </Row>

              <Text variant="caption" tone="muted">
                说明：macOS 电脑没有内置苹果「健康 (HealthKit)」数据库，因此 Mac 端支持两种真实自动同步方式：① 直接开启上方「扫描蓝牙体脂秤 / Keep 手环」通过 Mac 原生 CoreBluetooth 接收硬件广播；② 在下方绑定 Intervals.icu 云端（或在 iPhone「快捷指令 → 自动化」中配置起床自动推送 URL），即可实现手机称重、多端自动入账。
              </Text>

              <View
                style={[
                  styles.grantRow,
                  cardSurfaceStyle(color.card, color.line),
                  { borderColor: color.line },
                ]}
              >
                <View style={styles.grantInfo}>
                  <Stack gap="xs">
                    <Text variant="label">
                      Intervals.icu 开放健康云绑定（自动拉取 Apple Health / Keep / 佳明 / 小米体脂秤云端真实数据）
                    </Text>
                    <Row gap="sm" wrap>
                      <View style={{ flex: 1, minWidth: 160 }}>
                        <TextField
                          label="ATHLETE ID"
                          value={intervalsAthleteId}
                          onChangeText={setIntervalsAthleteId}
                          placeholder="例如 i123456"
                          autoCapitalize="none"
                        />
                      </View>
                      <View style={{ flex: 2, minWidth: 220 }}>
                        <TextField
                          label="API KEY"
                          value={intervalsApiKey}
                          onChangeText={setIntervalsApiKey}
                          placeholder="在 intervals.icu/settings 底部生成 API Key"
                          autoCapitalize="none"
                        />
                      </View>
                    </Row>
                    <Row gap="sm" align="center">
                      <Button
                        label={syncingProvider === 'intervals-icu' ? '验证并拉取中…' : '保存授权并拉取真实体重/训练'}
                        onPress={() => void onAuthorizeIntervalsCloud()}
                      />
                      <Button label="收起配置" variant="ghost" onPress={() => setAuthCenterOpen(false)} />
                    </Row>
                  </Stack>
                </View>
              </View>
            </Stack>
          </View>
        ) : null}

        {importOpen ? (
          <View style={[styles.subPanel, { backgroundColor: color.surface, borderColor: color.line }]}>
            <Stack gap="xs">
              <Text variant="caption" tone="muted">
                粘贴真实的 Keep 运动导出 JSON / CSV 或 Apple Health XML 记录，解析后自动写入今日「体重」与「训练」台账：
              </Text>
              <TextField
                label="KEEP / APPLE HEALTH / CSV 真实数据内容"
                value={importPayload}
                onChangeText={setImportPayload}
                placeholder='例如: {"weightKg":72.3,"heartRateBpm":145,"workouts":[{"exercise":"Keep 燃脂跑","reps":30}]} 或 CSV: 哑铃卧推,12,32,140,138'
                autoCapitalize="none"
              />
              <Row gap="sm" align="center" wrap>
                <Button
                  label="解析并写入台账"
                  onPress={() => void onRunImport(importPayload)}
                />
                <Button label="关闭" variant="ghost" onPress={() => setImportOpen(false)} />
              </Row>
            </Stack>
          </View>
        ) : null}
      </Stack>
    </Card>
  );
}

const styles = StyleSheet.create({
  statusBanner: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: theme.border.width,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 220,
    minWidth: 205,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 9,
    borderWidth: theme.border.width,
    gap: 6,
  },
  bigMono: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: theme.fontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },
  hrChartWrap: {
    width: 130,
    height: 36,
    position: 'relative',
    justifyContent: 'center',
  },
  scrubOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  scrubSlot: {
    flex: 1,
    height: '100%',
  },
  subPanel: {
    padding: theme.space.ms,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
  },
  grantRow: {
    padding: 12,
    borderRadius: 8,
    borderWidth: theme.border.width,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  grantInfo: {
    flex: 1,
    minWidth: 220,
    gap: 3,
  },
});
