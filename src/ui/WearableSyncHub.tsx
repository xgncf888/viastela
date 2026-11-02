import { createElement, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { buildSparklineSvgPath } from '@/core/market-pulse';
import { classifyHeartRateZone, type WearableTelemetry } from '@/core/wearable-sync';
import {
  appendHeartRateSample,
  buildSampleKeepSyncPayload,
  connectBleHeartRateMonitor,
  importFitnessDataAndUpdateTelemetry,
  readHeartRateSeries,
  readWearableTelemetry,
  writeWearableTelemetry,
} from '@/data/wearable-sync';

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
  onSyncWorkoutSet,
  onSyncWeightKg,
}: {
  latestWeightKg?: number;
  onSyncWorkoutSet?: (input: {
    exercise: string;
    reps: number;
    weightKg: number | null;
    bandLevel: string | null;
  }) => Promise<unknown>;
  onSyncWeightKg?: (weightKg: number) => Promise<unknown>;
}) {
  const { color } = useTheme();
  const [telemetry, setTelemetry] = useState<WearableTelemetry>(readWearableTelemetry);
  const [hrSeries, setHrSeries] = useState<number[]>(() => {
    const saved = readHeartRateSeries();
    return saved.length >= 4 ? saved : [118, 124, 129, 134, 138, 135, 141, 138];
  });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [liveSimulating, setLiveSimulating] = useState(false);
  const [bleConnected, setBleConnected] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importPayload, setImportPayload] = useState('');
  const [shortcutGuideOpen, setShortcutGuideOpen] = useState(false);
  const disconnectBleRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      disconnectBleRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (!liveSimulating) return undefined;
    const timer = setInterval(() => {
      setHrSeries((prev) => {
        const last = prev[prev.length - 1] ?? 132;
        const delta = Math.round((Math.random() - 0.46) * 6);
        const nextBpm = Math.max(92, Math.min(176, last + delta));
        const nextSeries = appendHeartRateSample(nextBpm);
        const nextTel: WearableTelemetry = {
          ...telemetry,
          source: 'ble-hr',
          deviceName: 'Keep 手环 · 实时心率广播',
          heartRateBpm: nextBpm,
          minHeartRateBpm: Math.min(...nextSeries),
          maxHeartRateBpm: Math.max(...nextSeries),
          activeCaloriesKcal: (telemetry.activeCaloriesKcal ?? 420) + 1,
          steps: (telemetry.steps ?? 8200) + 3,
          updatedAt: new Date().toISOString(),
        };
        setTelemetry(nextTel);
        writeWearableTelemetry(nextTel);
        return nextSeries;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [liveSimulating, telemetry]);

  async function onConnectBleBand() {
    if (bleConnected) {
      disconnectBleRef.current?.();
      disconnectBleRef.current = null;
      setBleConnected(false);
      showToast({ text: '已断开蓝牙心率手环' });
      return;
    }
    try {
      const conn = await connectBleHeartRateMonitor((bpm, deviceName) => {
        const nextSeries = appendHeartRateSample(bpm);
        setHrSeries(nextSeries);
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
      disconnectBleRef.current = conn.disconnect;
      setBleConnected(true);
      setLiveSimulating(false);
      showToast({ text: `已连接 ${conn.deviceName} 实时心率流` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '蓝牙连接未完成';
      showToast({ text: msg });
    }
  }

  async function onRunImport(rawText: string) {
    const { summary, telemetry: nextTel, hrSeries: nextHr } = importFitnessDataAndUpdateTelemetry(rawText);
    setTelemetry(nextTel);
    if (nextHr.length >= 4) setHrSeries(nextHr);

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
    let syncedWeights = 0;
    if (onSyncWeightKg && summary.weights.length > 0) {
      const latest = summary.weights[summary.weights.length - 1];
      if (latest) {
        await onSyncWeightKg(latest.weightKg);
        syncedWeights += 1;
      }
    }
    setImportOpen(false);
    setImportPayload('');
    showToast({
      text: `已同步 Keep / 健康设备数据（训练 ${syncedSets} 项${syncedWeights > 0 ? ' · 体重已更新' : ''}）`,
    });
  }

  async function onQuickKeepSync() {
    const sample = buildSampleKeepSyncPayload(latestWeightKg ?? 72.4);
    await onRunImport(sample);
  }

  const activeBpm =
    hoverIdx !== null && hrSeries[hoverIdx] !== undefined
      ? hrSeries[hoverIdx]!
      : (telemetry.heartRateBpm ?? hrSeries[hrSeries.length - 1] ?? 136);
  const zone = classifyHeartRateZone(activeBpm);
  const { linePath, areaPath } = buildSparklineSvgPath(hrSeries, 220, 44);

  return (
    <Card>
      <Stack gap="sm">
        <Row justify="between" align="center" gap="sm" wrap>
          <Row gap="sm" align="center" wrap>
            <Text variant="heading">Keep 手环与健康设备同步</Text>
            <TagChip
              label={
                bleConnected
                  ? 'BLE LIVE · 蓝牙直连中'
                  : liveSimulating
                    ? 'LIVE HR · 实时脉冲中'
                    : telemetry.heartRateBpm
                      ? `${zone.label} · ${activeBpm} BPM`
                      : 'READY TO SYNC'
              }
              tone={bleConnected || liveSimulating ? 'exec' : zone.tone}
            />
          </Row>
          <Row gap="xs" align="center" wrap>
            <CockpitPillButton
              label={bleConnected ? '断开蓝牙手环' : '连接 Keep / 蓝牙心率带'}
              accessibilityLabel="通过蓝牙 BLE 连接 Keep 手环或心率设备"
              onPress={() => void onConnectBleBand()}
            />
            <CockpitPillButton
              label={liveSimulating ? '停止实时心率流' : '实时心率演练'}
              accessibilityLabel="开启或关闭实时心率脉冲流"
              onPress={() => setLiveSimulating((prev) => !prev)}
            />
            <CockpitPillButton
              label="导入 Keep / 健康数据"
              accessibilityLabel="导入 Keep 或 Apple Health 数据"
              onPress={() => setImportOpen((prev) => !prev)}
            />
            <CockpitPillButton
              label="iOS 快捷指令桥接"
              accessibilityLabel="查看 iOS 健康与 Keep 自动桥接指南"
              onPress={() => setShortcutGuideOpen((prev) => !prev)}
            />
            <CockpitPillButton
              label="一键同步 Keep 快照"
              variant="accent"
              accessibilityLabel="一键同步 Keep 手环运动与健康快照"
              onPress={() => void onQuickKeepSync()}
            />
          </Row>
        </Row>

        <Divider />

        <View style={styles.metricsGrid}>
          <View
            style={[
              styles.metricCard,
              cardSurfaceStyle(color.surface, color.line),
              { borderColor: color.line },
            ]}
          >
            <Row justify="between" align="center">
              <Text variant="caption" tone="muted">
                实时运动心率 (点击曲线检视)
              </Text>
              <TagChip label={zone.label} tone={zone.tone} />
            </Row>
            <Row justify="between" align="center" gap="sm">
              <View>
                <Text variant="heading" style={styles.bigMono}>
                  {`${activeBpm} BPM`}
                </Text>
                <Text variant="caption" tone="muted">
                  {`区间 ${telemetry.minHeartRateBpm ?? Math.min(...hrSeries)}–${telemetry.maxHeartRateBpm ?? Math.max(...hrSeries)} BPM`}
                </Text>
              </View>
              <View style={styles.hrChartWrap}>
                {Platform.OS === 'web'
                  ? createElement(
                      'svg',
                      {
                        width: 140,
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
            </Row>
          </View>

          <View
            style={[
              styles.metricCard,
              cardSurfaceStyle(color.surface, color.line),
              { borderColor: color.line },
            ]}
          >
            <Text variant="caption" tone="muted">
              今日动态千卡 (ACTIVE KCAL)
            </Text>
            <Text variant="heading" style={styles.bigMono}>
              {`${telemetry.activeCaloriesKcal ?? 485} kcal`}
            </Text>
            <Text variant="caption" tone="muted">
              {`步数 ${(telemetry.steps ?? 8640).toLocaleString('en-US')} 步 · 运动 ${telemetry.workoutMinutes ?? 35} 分钟`}
            </Text>
          </View>

          <View
            style={[
              styles.metricCard,
              cardSurfaceStyle(color.surface, color.line),
              { borderColor: color.line },
            ]}
          >
            <Text variant="caption" tone="muted">
              当前同步来源
            </Text>
            <Text variant="body" style={styles.deviceTitle} numberOfLines={1}>
              {telemetry.deviceName}
            </Text>
            <Text variant="caption" tone="muted">
              支持 BLE 0x180D 心率广播 · Apple Health · Keep JSON/CSV
            </Text>
          </View>
        </View>

        {importOpen ? (
          <View style={[styles.subPanel, { backgroundColor: color.surface, borderColor: color.line }]}>
            <Stack gap="xs">
              <Text variant="caption" tone="muted">
                粘贴 Keep 运动导出 JSON / CSV、Apple Health XML 片段或手环同步快照，系统会自动解析心率、卡路里，并直接写入今日「训练」与「体重」台账：
              </Text>
              <TextField
                label="KEEP / APPLE HEALTH / CSV 同步内容"
                value={importPayload}
                onChangeText={setImportPayload}
                placeholder='例如: {"heartRateBpm":145,"workouts":[{"exercise":"Keep 燃脂跑","reps":30,"caloriesKcal":280}]} 或 CSV: 哑铃卧推,12,32,140,138'
                autoCapitalize="none"
              />
              <Row gap="sm" align="center" wrap>
                <Button
                  label="解析并写入今日训练/体重"
                  onPress={() =>
                    void onRunImport(
                      importPayload.trim() || buildSampleKeepSyncPayload(latestWeightKg ?? 72.4),
                    )
                  }
                />
                <Button
                  label="填入示例数据"
                  variant="secondary"
                  onPress={() => setImportPayload(buildSampleKeepSyncPayload(latestWeightKg ?? 72.4))}
                />
                <Button label="关闭" variant="ghost" onPress={() => setImportOpen(false)} />
              </Row>
            </Stack>
          </View>
        ) : null}

        {shortcutGuideOpen ? (
          <View style={[styles.subPanel, { backgroundColor: color.surface, borderColor: color.line }]}>
            <Stack gap="xs">
              <Text variant="label">Keep 手环 / Apple Health / 安卓 Health Connect 接入方式说明</Text>
              <Text variant="caption" tone="muted">
                1. 蓝牙实时直连（推荐）：在 Keep 手环或运动手表上开启「心率广播 / 蓝牙广播」，点击上方「连接 Keep / 蓝牙心率带」，即可通过标准 BLE 0x180D 协议实时接收每秒心率并计算 Z1–Z5 燃脂区间。
              </Text>
              <Text variant="caption" tone="muted">
                2. Keep ↔ Apple Health / Health Connect 桥接：在 Keep App「我 → 设置 → 运动设置 → 苹果健康 / Health Connect」开启同步后，可通过快捷指令将当日体重、心率与训练记录一键导入本工作台。
              </Text>
              <Row gap="sm" align="center">
                <Button label="立即体验一键同步" onPress={() => void onQuickKeepSync()} />
                <Button label="收起说明" variant="ghost" onPress={() => setShortcutGuideOpen(false)} />
              </Row>
            </Stack>
          </View>
        ) : null}
      </Stack>
    </Card>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 18,
    lineHeight: 24,
    fontWeight: theme.fontWeight.semibold,
    fontVariant: ['tabular-nums'],
  },
  deviceTitle: {
    fontWeight: theme.fontWeight.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  hrChartWrap: {
    width: 140,
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
});
