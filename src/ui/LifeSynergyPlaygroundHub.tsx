import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  buildLifeHeatmapGrid,
  computeBodyFocusCorrelation,
  computeTimeCapsuleStatus,
  formatMenuBarCapsuleTitle,
  type HeatmapCell,
  type PledgeVaultState,
  type TimeCapsuleItem,
} from '@/core/life-gamification';
import {
  type HabitItem,
  type LifeMilestone,
  sortMilestonesByUrgency,
} from '@/core/life-milestones-okr';
import { type StudyRecord } from '@/core/study';
import { type ActiveTimerSession, type TimeBlockItem } from '@/core/time-block-tracker';
import { type TrainingSet } from '@/core/training';
import { type WeightRecord } from '@/core/weight-stats';
import {
  addTimeCapsule,
  addWishVaultItem,
  pushNativeMenuBarTitle,
  readPledgeVault,
  readTimeCapsules,
  recordPledgePenalty,
  recordPledgeReward,
  redeemWishVaultItem,
  removeTimeCapsule,
  subscribeLifeGamificationStore,
} from '@/data/life-gamification';
import {
  readDailyHabits,
  readLifeMilestones,
  subscribeLifeOkrStore,
} from '@/data/life-milestones-okr';
import { readActiveTimer, readTimeBlocks } from '@/data/time-block-tracker';

import { useI18n } from './use-i18n';

import { Button } from './Button';
import { Card, cardSurfaceStyle } from './Card';
import { Chip } from './Chip';
import { ChipGroup } from './ChipGroup';
import { Divider, Row, Stack } from './layout';
import { ProgressBar } from './ProgressBar';
import { Text } from './Text';
import { TextField } from './TextField';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { showToast } from './toast';
import { CockpitPillButton, TagChip } from './WorkbenchConsole';

export function LifeSynergyPlaygroundHub({
  localDay,
  weightRecords,
  trainingSets,
  studyRecords,
}: {
  localDay: string;
  weightRecords: readonly WeightRecord[];
  trainingSets: readonly TrainingSet[];
  studyRecords: readonly StudyRecord[];
}) {
  const { color } = useTheme();
  const { t } = useI18n();
  const [vault, setVault] = useState<PledgeVaultState>(readPledgeVault);
  const [capsules, setCapsules] = useState<TimeCapsuleItem[]>(readTimeCapsules);
  const [milestones, setMilestones] = useState<LifeMilestone[]>(readLifeMilestones);
  const [habits, setHabits] = useState<HabitItem[]>(readDailyHabits);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlockItem[]>(readTimeBlocks);
  const [timer, setTimer] = useState<ActiveTimerSession>(readActiveTimer);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Heatmap range & inspection
  const [heatmapSpanDays, setHeatmapSpanDays] = useState<84 | 182 | 364>(182);
  const [selectedCellDay, setSelectedCellDay] = useState<string>(localDay);

  // Forms & modals
  const [wishFormOpen, setWishFormOpen] = useState(false);
  const [newWishTitle, setNewWishTitle] = useState('');
  const [newWishTargetCny, setNewWishTargetCny] = useState('1000');
  const [newWishLinked, setNewWishLinked] = useState('关联：纪念日心愿 / 阶段目标奖励');

  const [capsuleFormOpen, setCapsuleFormOpen] = useState(false);
  const [capTitle, setCapTitle] = useState('');
  const [capRecipient, setCapRecipient] = useState('写给未来的自己');
  const [capUnlockDay, setCapUnlockDay] = useState('2026-12-31');
  const [capMessage, setCapMessage] = useState('');
  const [openedCapsuleId, setOpenedCapsuleId] = useState<string | null>(null);

  useEffect(() => {
    const unsubGamification = subscribeLifeGamificationStore(() => {
      setVault(readPledgeVault());
      setCapsules(readTimeCapsules());
    });
    const unsubOkr = subscribeLifeOkrStore(() => {
      setMilestones(readLifeMilestones());
      setHabits(readDailyHabits());
    });
    const poll = setInterval(() => {
      setTimeBlocks(readTimeBlocks());
      setTimer(readActiveTimer());
      setNowMs(Date.now());
    }, 2000);
    return () => {
      unsubGamification();
      unsubOkr();
      clearInterval(poll);
    };
  }, []);

  const timerElapsedSeconds =
    timer.isRunning && timer.startedAtMs
      ? timer.accumulatedSeconds + Math.max(0, Math.floor((nowMs - timer.startedAtMs) / 1000))
      : timer.accumulatedSeconds;

  const sortedMilestones = sortMilestonesByUrgency(milestones, localDay);
  const nearestMilestone = sortedMilestones[0] ?? null;

  const menuBarTitle = formatMenuBarCapsuleTitle({
    timerRunning: timer.isRunning,
    timerTitle: timer.title,
    timerElapsedSeconds,
    nearestMilestoneTitle: nearestMilestone?.item.title ?? null,
    nearestMilestoneDays: nearestMilestone?.daysUntilNext ?? null,
    wishVaultCny: vault.wishBalanceCny,
  });

  useEffect(() => {
    void pushNativeMenuBarTitle(menuBarTitle);
  }, [menuBarTitle]);

  // Build daily lookup maps from real user records
  const weightDays = new Set<string>();
  weightRecords.forEach((r) => weightDays.add(r.localDay));

  const trainingCountByDay = new Map<string, number>();
  trainingSets.forEach((s) => {
    trainingCountByDay.set(s.localDay, (trainingCountByDay.get(s.localDay) ?? 0) + 1);
  });

  const studyMinutesByDay = new Map<string, number>();
  studyRecords.forEach((r) => {
    studyMinutesByDay.set(r.localDay, (studyMinutesByDay.get(r.localDay) ?? 0) + r.durationMinutes);
  });
  timeBlocks.forEach((b) => {
    if (b.category === 'study' || b.category === 'deep-work') {
      const prev = studyMinutesByDay.get(b.localDay) ?? 0;
      if (b.durationMinutes > prev) {
        studyMinutesByDay.set(b.localDay, b.durationMinutes);
      }
    }
  });

  const habitCountByDay = new Map<string, number>();
  habits.forEach((h) => {
    h.completedDays.forEach((d) => {
      habitCountByDay.set(d, (habitCountByDay.get(d) ?? 0) + 1);
    });
  });

  const milestoneByMonthDay = new Map<string, string>();
  milestones.forEach((m) => {
    const mmdd = m.targetDate.slice(5);
    if (mmdd) milestoneByMonthDay.set(mmdd, m.title);
  });

  const heatmap = buildLifeHeatmapGrid({
    endDay: localDay,
    totalDays: heatmapSpanDays,
    weightDays,
    trainingCountByDay,
    studyMinutesByDay,
    habitCountByDay,
    milestoneByMonthDay,
  });

  const inspectedCell: HeatmapCell | null =
    heatmap.cells.find((c) => c.localDay === selectedCellDay) ??
    heatmap.cells[heatmap.cells.length - 1] ??
    null;

  const correlation = computeBodyFocusCorrelation({
    endDay: localDay,
    windowDays: 28,
    weightDays,
    trainingCountByDay,
    studyMinutesByDay,
    timeBlocks,
  });

  const computedCapsules = capsules.map((c) => computeTimeCapsuleStatus(c, localDay));

  function cellColor(cell: HeatmapCell): string {
    if (cell.milestoneTitle && cell.level === 0) return color.warningSoft;
    if (cell.level === 0) return color.pill;
    if (cell.level === 1) return color.accentSoft;
    if (cell.level === 2) return color.greenSoft;
    if (cell.level === 3) return color.accent;
    return color.green;
  }

  function onAddWish() {
    if (!newWishTitle.trim()) {
      showToast({ text: '请输入心愿名称', tone: 'error' });
      return;
    }
    const target = Number.parseFloat(newWishTargetCny) || 1000;
    addWishVaultItem({
      title: newWishTitle,
      targetCny: target,
      linkedLabel: newWishLinked,
    });
    setNewWishTitle('');
    setWishFormOpen(false);
    showToast({ text: `已添加心愿目标：${newWishTitle.trim()} (¥${target})` });
  }

  function onCreateCapsule() {
    if (!capTitle.trim() || !capMessage.trim()) {
      showToast({ text: '请填写时间胶囊标题与信件内容', tone: 'error' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(capUnlockDay.trim())) {
      showToast({ text: '解锁日期格式需为 YYYY-MM-DD', tone: 'error' });
      return;
    }
    addTimeCapsule({
      title: capTitle,
      recipientLabel: capRecipient,
      message: capMessage,
      createdDay: localDay,
      unlockDay: capUnlockDay,
    });
    setCapTitle('');
    setCapMessage('');
    setCapsuleFormOpen(false);
    showToast({ text: `已封存时间胶囊「${capTitle.trim()}」，将于 ${capUnlockDay.trim()} 解锁` });
  }

  return (
    <Card>
      <Stack gap="sm">
        {/* Header & macOS Menu Bar Live Capsule Status */}
        <Row justify="between" align="center" gap="sm" wrap>
          <Row gap="sm" align="center" wrap>
            <Text variant="heading">
              {t('高阶联动实验室 · 对赌心愿金库 · 身心同频分析 · 年度星图与时间胶囊', 'Life Synergy Lab · Wish Pledge Vault · Mind-Body Correlation · Time Capsules')}
            </Text>
            <TagChip label={t(`菜单栏常驻: ${menuBarTitle}`, `Menu Bar: ${menuBarTitle}`)} tone="exec" />
          </Row>
          <Row gap="xs" align="center" wrap>
            <CockpitPillButton
              label={t('+ 新增心愿奖励', '+ Add Wish Reward')}
              accessibilityLabel="新增对赌心愿奖励池目标"
              onPress={() => setWishFormOpen((prev) => !prev)}
            />
            <CockpitPillButton
              label={t('+ 封存时间胶囊', '+ Seal Time Capsule')}
              accessibilityLabel="写一封定时解锁的时间胶囊信件"
              onPress={() => setCapsuleFormOpen((prev) => !prev)}
            />
            <CockpitPillButton
              label={t('同步 macOS 菜单栏', 'Sync macOS Menu Bar')}

              accessibilityLabel="立即将当前专注计时与纪念日倒数同步至 macOS 顶部状态栏"
              onPress={() => {
                void pushNativeMenuBarTitle(menuBarTitle).then((ok) => {
                  showToast({
                    text: ok
                      ? `已同步至 macOS 顶部菜单栏：${menuBarTitle}`
                      : `当前胶囊状态：${menuBarTitle}（在 macOS 原生客户端中常驻显示于屏幕右上角）`,
                  });
                });
              }}
            />
          </Row>
        </Row>

        <Divider />

        {/* 1. Habit & OKR -> Asset Pledge Vault (自律对赌基金与心愿奖励池) */}
        <Stack gap="xs">
          <Row justify="between" align="center" wrap>
            <Row gap="xs" align="center" wrap>
              <Text variant="label">1. 自律对赌基金 & 心愿奖励金库（Habit / OKR → Asset 联动）</Text>
              <TagChip
                label={`心愿金库 ¥${vault.wishBalanceCny} · 定投惩罚池 ¥${vault.penaltyDcaPoolCny}`}
                tone="owner"
              />
            </Row>
            <Row gap="xs" align="center" wrap>
              <CockpitPillButton
                label={`＋ 满勤打卡注入 +¥${vault.config.checkInRewardCny}`}
                variant="green"
                accessibilityLabel="注入今日满勤自律奖励金"
                onPress={() => {
                  recordPledgeReward('完成今日全套自律指标满勤奖励', localDay);
                  showToast({
                    text: `已向心愿金库注入 +¥${vault.config.checkInRewardCny} 奖励金！`,
                  });
                }}
              />
              <CockpitPillButton
                label={`⚡ 断签定投惩罚 +¥${vault.config.missedPenaltyCny}`}
                accessibilityLabel="触发断签定投惩罚转入指数定投池"
                onPress={() => {
                  recordPledgePenalty(`未达标对赌转入「${vault.config.penaltyIndexName}」`, localDay);
                  showToast({
                    text: `已执行对赌契约：¥${vault.config.missedPenaltyCny} 已记入「${vault.config.penaltyIndexName}」`,
                  });
                }}
              />
            </Row>
          </Row>

          <Text variant="caption" tone="muted">
            每次在上方完成「每日习惯打卡」或「OKR 关键结果推进」，系统都会自动向心愿金库注入奖励金并按序充入下方心愿单；若断签则按契约转入宽基指数定投池。
          </Text>

          {wishFormOpen ? (
            <View style={[styles.subPanel, { backgroundColor: color.surface, borderColor: color.line }]}>
              <Stack gap="xs">
                <Text variant="label">新增心愿奖励目标（用每一次打卡和训练为心愿蓄力）</Text>
                <Row gap="sm" wrap>
                  <View style={{ flex: 2, minWidth: 180 }}>
                    <TextField
                      label="心愿或纪念日礼物名称"
                      value={newWishTitle}
                      onChangeText={setNewWishTitle}
                      placeholder="例如：纪念日海岛旅行 / 升级 Apple Watch Ultra"
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 110 }}>
                    <TextField
                      label="目标金额 (¥)"
                      value={newWishTargetCny}
                      onChangeText={setNewWishTargetCny}
                      placeholder="1500"
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={{ flex: 2, minWidth: 180 }}>
                    <TextField
                      label="关联纪念日或 OKR 标签"
                      value={newWishLinked}
                      onChangeText={setNewWishLinked}
                      placeholder="关联：重要纪念日"
                    />
                  </View>
                </Row>
                <Row gap="sm">
                  <Button label="创建心愿目标" onPress={onAddWish} />
                  <Button label="取消" variant="ghost" onPress={() => setWishFormOpen(false)} />
                </Row>
              </Stack>
            </View>
          ) : null}

          <View style={styles.wishGrid}>
            {vault.wishes.map((wish) => {
              const pct = Math.min(100, Math.round((wish.allocatedCny / Math.max(1, wish.targetCny)) * 100));
              const canRedeem = pct >= 100 && !wish.redeemed;
              return (
                <View
                  key={wish.id}
                  style={[
                    styles.wishCard,
                    cardSurfaceStyle(color.surface, color.line),
                    { borderColor: wish.redeemed ? color.green : canRedeem ? color.accent : color.line },
                  ]}
                >
                  <Row justify="between" align="center" gap="xs">
                    <View style={{ flex: 1 }}>
                      <Row gap="xs" align="center">
                        <TagChip
                          label={wish.redeemed ? '已解锁兑现' : wish.linkedLabel}
                          tone={wish.redeemed ? 'exec' : 'pod'}
                        />
                        <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
                          {wish.title}
                        </Text>
                      </Row>
                    </View>
                    <Text variant="label">
                      {`¥${wish.allocatedCny} / ¥${wish.targetCny} (${pct}%)`}
                    </Text>
                  </Row>
                  <ProgressBar value={pct / 100} masked={false} />
                  <Row justify="between" align="center">
                    <Text variant="caption" tone="muted">
                      {wish.redeemed
                        ? '✓ 已凭自律积分圆满兑现该心愿'
                        : `还需 ${Math.max(0, Math.ceil((wish.targetCny - wish.allocatedCny) / vault.config.checkInRewardCny))} 次打卡即可全额解锁`}
                    </Text>
                    {!wish.redeemed && wish.allocatedCny > 0 ? (
                      <CockpitPillButton
                        label={canRedeem ? '🎉 立即兑现心愿' : '提前兑现'}
                        variant={canRedeem ? 'green' : 'default'}
                        accessibilityLabel={`兑现心愿 ${wish.title}`}
                        onPress={() => {
                          redeemWishVaultItem(wish.id, localDay);
                          showToast({ text: `🎉 恭喜兑现心愿：${wish.title}！` });
                        }}
                      />
                    ) : null}
                  </Row>
                </View>
              );
            })}
          </View>
        </Stack>

        <Divider />

        {/* 2. Health x Focus Correlation Engine (身体状态 × 专注心流相关性分析) */}
        <Stack gap="xs">
          <Row justify="between" align="center" wrap>
            <Text variant="label">2. 身体状态 × 专注心流相关性引擎（基于近 28 天真实训练、晨重与 24H 时间块计算）</Text>
            <TagChip label={`身心同频指数 ${correlation.synergyScore} / 100`} tone="exec" />
          </Row>

          <View style={styles.correlationGrid}>
            <View style={[styles.corrMetricBox, cardSurfaceStyle(color.surface, color.line)]}>
              <Text variant="caption" tone="muted">
                训练日 vs 非训练日平均专注
              </Text>
              <Text variant="heading">
                {`${correlation.avgFocusOnTrainingDayMins} min vs ${correlation.avgFocusOnRestDayMins} min`}
              </Text>
              <Text variant="caption" tone="muted">
                {correlation.trainingFocusBoostPct !== null
                  ? `运动日认知专注度变化 ${correlation.trainingFocusBoostPct >= 0 ? `+${correlation.trainingFocusBoostPct}%` : `${correlation.trainingFocusBoostPct}%`}`
                  : `近 28 天已记录 ${correlation.trainingDaysCount} 个训练日`}
              </Text>
            </View>

            <View style={[styles.corrMetricBox, cardSurfaceStyle(color.surface, color.line)]}>
              <Text variant="caption" tone="muted">
                24H 黄金心流时段定位
              </Text>
              <Text variant="heading">{correlation.goldenHourLabel}</Text>
              <Text variant="caption" tone="muted">
                {correlation.goldenHourMinutes > 0
                  ? `该时段累计高密专注 ${correlation.goldenHourMinutes} 分钟`
                  : '在 24H 时间块记录学习后自动锁定峰值时段'}
              </Text>
            </View>

            <View style={[styles.corrMetricBox, cardSurfaceStyle(color.surface, color.line), { flex: 1.5 }]}>
              <Text variant="caption" tone="muted">
                量化自我实证洞察
              </Text>
              <Text variant="label">{correlation.insightHeadline}</Text>
              <Text variant="caption" tone="muted">
                {correlation.insightDetail}
              </Text>
            </View>
          </View>
        </Stack>

        <Divider />

        {/* 3. Annual 365-Day Style Life Astrolabe Heatmap (年度人生星图热力矩阵) */}
        <Stack gap="xs">
          <Row justify="between" align="center" wrap gap="sm">
            <Row gap="xs" align="center" wrap>
              <Text variant="label">
                3. 年度「人生星图」自律热力矩阵（融合晨重 · 训练 · 深度专注 · 习惯打卡 · 纪念日）
              </Text>
              <TagChip
                label={`活跃 ${heatmap.activeDaysCount} 天 · 满贯 ${heatmap.perfectDaysCount} 天`}
                tone="owner"
              />
            </Row>
            <ChipGroup>
              <Chip
                label="近 12 周 (84d)"
                selected={heatmapSpanDays === 84}
                onPress={() => setHeatmapSpanDays(84)}
              />
              <Chip
                label="近半年 (182d)"
                selected={heatmapSpanDays === 182}
                onPress={() => setHeatmapSpanDays(182)}
              />
              <Chip
                label="全年星图 (364d)"
                selected={heatmapSpanDays === 364}
                onPress={() => setHeatmapSpanDays(364)}
              />
            </ChipGroup>
          </Row>

          <View
            style={[
              styles.heatmapContainer,
              { backgroundColor: color.surface, borderColor: color.line },
            ]}
          >
            <View style={styles.heatmapCellsWrap}>
              {heatmap.cells.map((cell) => {
                const isSelected = inspectedCell?.localDay === cell.localDay;
                return (
                  <Pressable
                    key={cell.localDay}
                    accessibilityRole="button"
                    accessibilityLabel={`星图 ${cell.localDay} 等级 ${cell.level}`}
                    onPress={() => setSelectedCellDay(cell.localDay)}
                    style={[
                      styles.heatCell,
                      {
                        backgroundColor: cellColor(cell),
                        borderColor: isSelected
                          ? color.ink
                          : cell.milestoneTitle
                            ? color.warning
                            : 'transparent',
                        borderWidth: isSelected || cell.milestoneTitle ? 1.5 : 0,
                      },
                    ]}
                  />
                );
              })}
            </View>

            {inspectedCell ? (
              <Row justify="between" align="center" wrap gap="sm">
                <Row gap="xs" align="center" wrap>
                  <TagChip label={inspectedCell.localDay} tone="owner" />
                  {inspectedCell.milestoneTitle ? (
                    <TagChip label={`★ ${inspectedCell.milestoneTitle}`} tone="exec" />
                  ) : null}
                  <Text variant="caption">
                    {`热力 Lv.${inspectedCell.level}/4 · 晨重: ${inspectedCell.hasWeight ? '已记' : '未记'} · 训练: ${inspectedCell.trainingCount} 组 · 专注: ${inspectedCell.studyMinutes}m · 习惯: ${inspectedCell.habitCount} 项`}
                  </Text>
                </Row>
                <Row gap="xs" align="center">
                  <Text variant="caption" tone="muted">
                    密度图例：
                  </Text>
                  {[0, 1, 2, 3, 4].map((lv) => (
                    <View
                      key={`legend-${lv}`}
                      style={[
                        styles.legendCell,
                        {
                          backgroundColor: cellColor({
                            localDay: '',
                            level: lv as 0 | 1 | 2 | 3 | 4,
                            score: lv,
                            hasWeight: false,
                            trainingCount: 0,
                            studyMinutes: 0,
                            habitCount: 0,
                            milestoneTitle: null,
                          }),
                        },
                      ]}
                    />
                  ))}
                </Row>
              </Row>
            ) : null}
          </View>
        </Stack>

        <Divider />

        {/* 4. Time Capsule Vault (定时解锁时间胶囊信箱) */}
        <Stack gap="xs">
          <Row justify="between" align="center" wrap>
            <Text variant="label">4. 时间胶囊信箱（给未来的纪念日或年末收官日写一封信，未到期前严格封印）</Text>
            <Text variant="caption" tone="muted">
              到期自动解锁，记录每个阶段的真实心境与期许
            </Text>
          </Row>

          {capsuleFormOpen ? (
            <View style={[styles.subPanel, { backgroundColor: color.surface, borderColor: color.line }]}>
              <Stack gap="xs">
                <Text variant="label">封存一封新的时间胶囊（在到达解锁日期前将保持加密封印状态）</Text>
                <Row gap="sm" wrap>
                  <View style={{ flex: 2, minWidth: 180 }}>
                    <TextField
                      label="胶囊标题"
                      value={capTitle}
                      onChangeText={setCapTitle}
                      placeholder="例如：写给 3 周年纪念日的我们 / 写给 1000 小时达成日"
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 130 }}>
                    <TextField
                      label="定时解锁日期 (YYYY-MM-DD)"
                      value={capUnlockDay}
                      onChangeText={setCapUnlockDay}
                      placeholder="2026-12-31"
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 140 }}>
                    <TextField
                      label="收信人 / 场景标签"
                      value={capRecipient}
                      onChangeText={setCapRecipient}
                      placeholder="写给未来的自己"
                    />
                  </View>
                </Row>
                <TextField
                  label="信件正文"
                  value={capMessage}
                  onChangeText={setCapMessage}
                  placeholder="写下此刻的目标、体重与资产状态，或者对未来纪念日的期许..."
                />
                <Row gap="sm">
                  <Button label="封存时间胶囊" onPress={onCreateCapsule} />
                  <Button label="取消" variant="ghost" onPress={() => setCapsuleFormOpen(false)} />
                </Row>
              </Stack>
            </View>
          ) : null}

          <View style={styles.wishGrid}>
            {computedCapsules.map((item) => {
              const isOpen = openedCapsuleId === item.capsule.id;
              return (
                <View
                  key={item.capsule.id}
                  style={[
                    styles.wishCard,
                    cardSurfaceStyle(color.surface, color.line),
                    { borderColor: item.isUnlocked ? color.green : color.line },
                  ]}
                >
                  <Row justify="between" align="center" gap="xs">
                    <View style={{ flex: 1 }}>
                      <Row gap="xs" align="center">
                        <TagChip
                          label={item.isUnlocked ? '🔓 已解锁' : '🔒 封印中'}
                          tone={item.isUnlocked ? 'exec' : 'pod'}
                        />
                        <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
                          {item.capsule.title}
                        </Text>
                      </Row>
                    </View>
                    {capsules.length > 1 ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`删除时间胶囊 ${item.capsule.title}`}
                        onPress={() => removeTimeCapsule(item.capsule.id)}
                        style={styles.removeBtn}
                      >
                        <Text variant="caption" tone="muted">
                          ×
                        </Text>
                      </Pressable>
                    ) : null}
                  </Row>

                  <Text variant="caption" tone="muted">
                    {`${item.capsule.recipientLabel} · 封存于 ${item.capsule.createdDay} · ${item.statusBadge}`}
                  </Text>

                  {item.isUnlocked ? (
                    <>
                      <Row justify="between" align="center">
                        <CockpitPillButton
                          label={isOpen ? '收起信件' : '拆阅时间胶囊'}
                          variant="green"
                          onPress={() =>
                            setOpenedCapsuleId((cur) =>
                              cur === item.capsule.id ? null : item.capsule.id,
                            )
                          }
                        />
                      </Row>
                      {isOpen ? (
                        <View
                          style={[
                            styles.capsuleLetterBox,
                            { backgroundColor: color.pill, borderColor: color.lineSoft },
                          ]}
                        >
                          <Text variant="body">{item.capsule.message}</Text>
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <View
                      style={[
                        styles.capsuleLetterBox,
                        { backgroundColor: color.pill, borderColor: color.lineSoft },
                      ]}
                    >
                      <Text variant="caption" tone="muted">
                        {`🔒 该信件正在时间胶囊中封印保存，将于 ${item.capsule.unlockDay}（${item.daysUntilUnlock} 天后）正式开启。`}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </Stack>
      </Stack>
    </Card>
  );
}

const styles = StyleSheet.create({
  subPanel: {
    padding: theme.space.sm,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
  },
  wishGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  wishCard: {
    flex: 1,
    minWidth: 260,
    padding: theme.space.sm,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
    gap: 6,
  },
  correlationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  corrMetricBox: {
    flex: 1,
    minWidth: 210,
    padding: theme.space.sm,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
    gap: 4,
  },
  heatmapContainer: {
    padding: theme.space.sm,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
    gap: theme.space.xs,
  },
  heatmapCellsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  heatCell: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendCell: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  heatmapFooter: {
    paddingTop: 4,
  },
  capsuleLetterBox: {
    padding: theme.space.xs,
    borderRadius: theme.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  removeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
