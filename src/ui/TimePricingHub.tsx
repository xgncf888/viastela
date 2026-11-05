import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  BUY_TIME_PRESET_SCENARIOS,
  computeDailyTimeValueLedger,
  computeExpenseLifeHours,
  computeHourlyRateBreakdown,
  evaluateBuyTimeDecision,
  type TimePricingConfig,
} from '@/core/time-pricing';
import { subscribeBookkeepingStore } from '@/data/bookkeeping';
import { readActiveTimer, readTimeBlocks } from '@/data/time-block-tracker';
import {
  detectBookkeepingIncomeAndWorkCost,
  readEffectiveTimePricing,
  subscribeTimePricingStore,
  writeTimePricingConfig,
} from '@/data/time-pricing';

import { Button } from './Button';
import { Card, cardSurfaceStyle } from './Card';
import { Divider, Row, Stack } from './layout';
import { ProgressBar } from './ProgressBar';
import { Text } from './Text';
import { TextField } from './TextField';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { showToast } from './toast';
import { useI18n } from './use-i18n';
import { CockpitPillButton, TagChip } from './WorkbenchConsole';

const INCOME_QUICK_PRESETS = [12000, 20000, 30000, 45000, 60000] as const;
const MULTIPLIER_PRESETS = [1.5, 2.0, 2.5, 3.0] as const;

export function TimePricingHub({
  localDay,
  onJumpToLedger,
  onJumpToDayCycle,
}: {
  localDay: string;
  onJumpToLedger?: () => void;
  onJumpToDayCycle?: () => void;
}) {
  const { color } = useTheme();
  const { t } = useI18n();

  const [pricingState, setPricingState] = useState(() => readEffectiveTimePricing());
  const [detectedLedger, setDetectedLedger] = useState(() => detectBookkeepingIncomeAndWorkCost());
  const [blocks, setBlocks] = useState(() => readTimeBlocks());
  const [activeTimer, setActiveTimer] = useState(() => readActiveTimer());

  // Form states synced with config
  const [incomeInput, setIncomeInput] = useState(() =>
    pricingState.config.monthlyNetIncomeCny > 0
      ? String(pricingState.config.monthlyNetIncomeCny)
      : '',
  );
  const [partnerIncomeInput, setPartnerIncomeInput] = useState(() =>
    pricingState.config.partnerMonthlyNetIncomeCny > 0
      ? String(pricingState.config.partnerMonthlyNetIncomeCny)
      : '',
  );
  const [workExpenseInput, setWorkExpenseInput] = useState(() =>
    pricingState.config.monthlyWorkExpenseCny > 0
      ? String(pricingState.config.monthlyWorkExpenseCny)
      : '',
  );
  const [overtimeInput, setOvertimeInput] = useState(() =>
    String(pricingState.config.dailyOvertimeHours),
  );
  const [commuteInput, setCommuteInput] = useState(() =>
    String(pricingState.config.dailyCommuteMinutes),
  );
  const [decompressionInput, setDecompressionInput] = useState(() =>
    String(pricingState.config.dailyDecompressionMinutes),
  );

  // Interactive Buy-Time (+EV) Calculator State
  const [buyCostInput, setBuyCostInput] = useState('38');
  const [buySavedMinsInput, setBuySavedMinsInput] = useState('45');
  const [buyUseCompound, setBuyUseCompound] = useState(false);

  // Interactive Expense-to-Life-Hours Converter State
  const [itemPriceInput, setItemPriceInput] = useState('1299');

  useEffect(() => {
    const refresh = () => {
      const next = readEffectiveTimePricing();
      setPricingState(next);
      setDetectedLedger(detectBookkeepingIncomeAndWorkCost());
      setBlocks(readTimeBlocks());
      setActiveTimer(readActiveTimer());
    };
    const unsubPricing = subscribeTimePricingStore(refresh);
    const unsubLedger = subscribeBookkeepingStore(refresh);
    return () => {
      unsubPricing();
      unsubLedger();
    };
  }, []);

  function applyConfigPatch(patch: Partial<TimePricingConfig>, toastMsg?: string) {
    const saved = writeTimePricingConfig(patch);
    setPricingState({
      config: saved,
      breakdown: computeHourlyRateBreakdown(saved),
      autoSyncedFromLedger: false,
    });
    if (patch.monthlyNetIncomeCny !== undefined) {
      setIncomeInput(patch.monthlyNetIncomeCny > 0 ? String(patch.monthlyNetIncomeCny) : '');
    }
    if (patch.partnerMonthlyNetIncomeCny !== undefined) {
      setPartnerIncomeInput(
        patch.partnerMonthlyNetIncomeCny > 0 ? String(patch.partnerMonthlyNetIncomeCny) : '',
      );
    }
    if (patch.monthlyWorkExpenseCny !== undefined) {
      setWorkExpenseInput(
        patch.monthlyWorkExpenseCny > 0 ? String(patch.monthlyWorkExpenseCny) : '',
      );
    }
    if (toastMsg) {
      showToast({ text: toastMsg });
    }
  }

  function handleSaveBaseline() {
    const netIncome = Math.max(0, Number.parseFloat(incomeInput) || 0);
    const partnerIncome = Math.max(0, Number.parseFloat(partnerIncomeInput) || 0);
    const workExpense = Math.max(0, Number.parseFloat(workExpenseInput) || 0);
    const overtime = Math.max(0, Number.parseFloat(overtimeInput) || 0);
    const commute = Math.max(0, Number.parseFloat(commuteInput) || 0);
    const decompression = Math.max(0, Number.parseFloat(decompressionInput) || 0);

    applyConfigPatch(
      {
        monthlyNetIncomeCny: netIncome,
        partnerMonthlyNetIncomeCny: partnerIncome,
        monthlyWorkExpenseCny: workExpense,
        dailyOvertimeHours: overtime,
        dailyCommuteMinutes: commute,
        dailyDecompressionMinutes: decompression,
      },
      t('已更新真实时薪与时间定价模型', 'Updated True Hourly Rate & Time Pricing Model'),
    );
  }

  function handleSyncFromLedger() {
    const det = detectBookkeepingIncomeAndWorkCost();
    setDetectedLedger(det);
    if (det.detectedMonthlyIncomeCny <= 0 && det.detectedPartnerIncomeCny <= 0) {
      showToast({
        text: t(
          '记账本暂未录入月薪规则或本月收入流水，你可以直接在下方输入或点击预设月薪',
          'No salary found in ledger yet; enter below or tap a quick preset',
        ),
      });
      return;
    }
    const nextIncome =
      det.detectedMonthlyIncomeCny > 0
        ? det.detectedMonthlyIncomeCny
        : det.detectedPartnerIncomeCny;
    const nextPartner = det.detectedMonthlyIncomeCny > 0 ? det.detectedPartnerIncomeCny : 0;
    applyConfigPatch(
      {
        monthlyNetIncomeCny: nextIncome,
        partnerMonthlyNetIncomeCny: nextPartner,
        includePartnerInPool: nextPartner > 0,
        monthlyWorkExpenseCny:
          det.detectedWorkExpenseCny > 0
            ? det.detectedWorkExpenseCny
            : pricingState.config.monthlyWorkExpenseCny,
      },
      t(
        `已从记账本同步月收入 ¥${(nextIncome + nextPartner).toLocaleString()}`,
        `Synced ¥${(nextIncome + nextPartner).toLocaleString()} from Ledger`,
      ),
    );
  }

  const { config, breakdown, autoSyncedFromLedger } = pricingState;
  const todayBlocks = blocks.filter((b) => b.localDay === localDay);
  const dailyValueLedger = computeDailyTimeValueLedger(
    todayBlocks,
    breakdown,
    activeTimer.accumulatedSeconds,
    activeTimer.category,
  );

  const buyDecision = evaluateBuyTimeDecision({
    costCny: Number.parseFloat(buyCostInput) || 0,
    savedMinutes: Number.parseFloat(buySavedMinsInput) || 0,
    trueNetHourlyCny: breakdown.trueNetHourlyCny,
    focusCompoundHourlyCny: breakdown.focusCompoundHourlyCny,
    useCompoundRate: buyUseCompound,
  });

  const itemLifeHours = computeExpenseLifeHours(
    Number.parseFloat(itemPriceInput) || 0,
    breakdown.trueNetHourlyCny,
    config.dailyContractHours + config.dailyOvertimeHours,
  );

  return (
    <Card>
      <Stack gap="md">
        {/* Header & Cross-Module Badges */}
        <Row justify="between" align="center" gap="sm" wrap>
          <Stack gap="xs">
            <Row gap="xs" align="center" wrap>
              <Text variant="heading">
                {t(
                  '⏳ 真实时薪与时间定价引擎 · 生命工时换算 · 花钱买时间 (+EV) 决策器',
                  '⏳ True Hourly Rate Engine · Life-Hours Price Tag · Buy-Time (+EV) Calculator',
                )}
              </Text>
              <TagChip
                label={
                  breakdown.trueNetHourlyCny > 0
                    ? `真实净时薪 ¥${breakdown.trueNetHourlyCny.toFixed(1)}/h · ¥${breakdown.minuteRateCny.toFixed(2)}/min`
                    : t('待设定月薪基线', 'Awaiting Income Baseline')
                }
                tone={breakdown.trueNetHourlyCny > 0 ? 'exec' : 'owner'}
              />
            </Row>
            <Text variant="caption" tone="muted">
              {t(
                '与「记账本」和「24H 时间块」深度打通：每一笔消费自动换算真实生命工时，每一段专注计时实时跳动创造的复利价值',
                'Connected with Ledger & 24H Time-Blocks: convert every expense into life hours and watch live focus sessions compound in value',
              )}
            </Text>
          </Stack>

          <Row gap="xs" align="center" wrap>
            <CockpitPillButton
              label={t('⇄ 从记账本同步月薪', '⇄ Sync from Ledger')}
              accessibilityLabel="从记账本同步月收入与通勤开销"
              onPress={handleSyncFromLedger}
            />
            {onJumpToDayCycle ? (
              <CockpitPillButton
                label={t('⏱ 去 24H 时间块看今日产出', '⏱ View 24H Time-Blocks')}
                accessibilityLabel="前往 24H 时间块查看实时专注价值"
                onPress={onJumpToDayCycle}
              />
            ) : null}
            {onJumpToLedger ? (
              <CockpitPillButton
                label={t('¥ 去记账本看消费工时', '¥ View Ledger Life-Hours')}
                accessibilityLabel="前往记账本查看消费折算生命工时"
                onPress={onJumpToLedger}
              />
            ) : null}
          </Row>
        </Row>

        <Divider />

        {/* 1. Three-Tier Hourly Rate Hero Cards */}
        <View style={styles.heroGrid}>
          {/* Tier 1: Nominal Hourly Rate */}
          <View style={[styles.heroCard, cardSurfaceStyle(color.surface, color.line)]}>
            <Row justify="between" align="center">
              <TagChip label={t('第 1 层 · 账面合同母体时薪', 'Tier 1 · Nominal Paper Rate')} tone="pod" />
              <Text variant="caption" tone="muted">
                {`${breakdown.nominalMonthlyHours.toFixed(0)}h / 月`}
              </Text>
            </Row>
            <Text variant="display" style={styles.heroNumber}>
              {`¥${breakdown.nominalHourlyCny.toFixed(1)}`}
              <Text variant="caption" tone="muted">
                {' / h'}
              </Text>
            </Text>
            <Text variant="caption" tone="muted">
              {t(
                `按税后月入 ¥${breakdown.grossPoolIncomeCny.toLocaleString()} ÷ 合同工时计算（未扣除通勤、加班与回血损耗）`,
                `Based on ¥${breakdown.grossPoolIncomeCny.toLocaleString()} ÷ contract hours (before commute/overtime)`,
              )}
            </Text>
          </View>

          {/* Tier 2: True Net Hourly Rate (Core Life-Energy Price) */}
          <View
            style={[
              styles.heroCard,
              cardSurfaceStyle(color.surface, color.accent),
              { borderColor: color.accent },
            ]}
          >
            <Row justify="between" align="center">
              <TagChip
                label={t('第 2 层 · 真实生命净时薪 (核心标尺)', 'Tier 2 · True Net Life Rate')}
                tone="exec"
              />
              <Text variant="caption" style={{ color: color.accent }}>
                {`¥${breakdown.minuteRateCny.toFixed(2)} / min`}
              </Text>
            </Row>
            <Text variant="display" style={[styles.heroNumber, { color: color.accent }]}>
              {`¥${breakdown.trueNetHourlyCny.toFixed(1)}`}
              <Text variant="caption" tone="muted">
                {' / h'}
              </Text>
            </Text>
            <Text variant="caption" tone="muted">
              {breakdown.nominalHourlyCny > 0
                ? t(
                    `扣除工作硬性消费 ¥${config.monthlyWorkExpenseCny}/月 与每月 ${breakdown.hiddenMonthlyHours.toFixed(0)}h 隐形工时后，真实留存率 ${breakdown.effectiveRetentionPct}%（每 15m 时间块价值 ¥${breakdown.quarterHourCny.toFixed(1)}）`,
                    `After ¥${config.monthlyWorkExpenseCny}/mo work expenses & ${breakdown.hiddenMonthlyHours.toFixed(0)}h hidden hours (${breakdown.effectiveRetentionPct}% retention)`,
                  )
                : t(
                    '在下方点击预设月薪或输入税后收入，立即算出你每一分钟的真实生命价格',
                    'Pick a salary preset or enter take-home income below to price every minute',
                  )}
            </Text>
          </View>

          {/* Tier 3: Compounding Deep-Focus Rate */}
          <View style={[styles.heroCard, cardSurfaceStyle(color.surface, color.green)]}>
            <Row justify="between" align="center">
              <TagChip
                label={t(
                  `第 3 层 · 深度创造复利时薪 (${config.focusCompoundMultiplier}×)`,
                  `Tier 3 · Deep Focus Compound (${config.focusCompoundMultiplier}×)`,
                )}
                tone="owner"
              />
              <Text variant="caption" tone="muted">
                {t('10,000h 精进计价', '10,000h Mastery Rate')}
              </Text>
            </Row>
            <Text variant="display" style={[styles.heroNumber, { color: color.green }]}>
              {`¥${breakdown.focusCompoundHourlyCny.toFixed(1)}`}
              <Text variant="caption" tone="muted">
                {' / h'}
              </Text>
            </Text>
            <Text variant="caption" tone="muted">
              {t(
                `投入学习、架构研发与健身精进的时间具有长期复利效应。今日已创造 +¥${dailyValueLedger.totalValueCreatedCny.toFixed(1)} 时间价值`,
                `Deep study, engineering & fitness compound over time. Created +¥${dailyValueLedger.totalValueCreatedCny.toFixed(1)} today`,
              )}
            </Text>
          </View>
        </View>

        {/* 2. Baseline Configuration & Hidden Work-Hour Drag */}
        <View style={[styles.sectionBox, cardSurfaceStyle(color.surface, color.line)]}>
          <Stack gap="sm">
            <Row justify="between" align="center" wrap>
              <Stack gap="xs">
                <Text variant="label">
                  {t(
                    '1. 真实时薪基线校准（《Your Money or Your Life》生命能量算法）',
                    '1. True Hourly Rate Calibration (Life-Energy Model)',
                  )}
                </Text>
                <Text variant="caption" tone="muted">
                  {autoSyncedFromLedger
                    ? detectedLedger.sourceLabelZh
                    : t(
                        '快速点选月薪档位或填入你的真实通勤/加班/回血时长，看看隐形工时吃掉了多少账面时薪',
                        'Select a salary preset or enter commute/overtime to see hidden time drag',
                      )}
                </Text>
              </Stack>

              <Row gap="xs" align="center" wrap>
                <Text variant="caption" tone="muted">
                  {t('快速试算月薪:', 'Quick Salary:')}
                </Text>
                {INCOME_QUICK_PRESETS.map((preset) => (
                  <CockpitPillButton
                    key={preset}
                    label={`¥${(preset / 1000).toFixed(0)}k`}
                    active={config.monthlyNetIncomeCny === preset}
                    accessibilityLabel={`设定税后月薪为 ${preset} 元`}
                    onPress={() =>
                      applyConfigPatch(
                        { monthlyNetIncomeCny: preset },
                        `已切换税后月薪基线为 ¥${preset.toLocaleString()}`,
                      )
                    }
                  />
                ))}
              </Row>
            </Row>

            <Row gap="sm" wrap>
              <View style={styles.fieldCol}>
                <TextField
                  label={t('个人税后月薪 (¥/月)', 'Monthly Net Income (¥)')}
                  value={incomeInput}
                  onChangeText={setIncomeInput}
                  placeholder="例如 25000"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.fieldCol}>
                <TextField
                  label={t('伴侣税后月薪 (可选合池 ¥/月)', 'Partner Net Income (¥)')}
                  value={partnerIncomeInput}
                  onChangeText={setPartnerIncomeInput}
                  placeholder="例如 20000"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.fieldCol}>
                <TextField
                  label={t('因工作产生的月开销 (通勤/外卖/咖啡 ¥)', 'Work-Induced Monthly Cost (¥)')}
                  value={workExpenseInput}
                  onChangeText={setWorkExpenseInput}
                  placeholder="例如 1500"
                  keyboardType="decimal-pad"
                />
              </View>
            </Row>

            <Row gap="sm" wrap>
              <View style={styles.fieldCol}>
                <TextField
                  label={t('日均隐形加班/回消息 (小时/天)', 'Daily Overtime (hours/day)')}
                  value={overtimeInput}
                  onChangeText={setOvertimeInput}
                  placeholder="1.0"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.fieldCol}>
                <TextField
                  label={t('每日往返通勤总时长 (分钟/天)', 'Daily Round-Trip Commute (mins)')}
                  value={commuteInput}
                  onChangeText={setCommuteInput}
                  placeholder="60"
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.fieldCol}>
                <TextField
                  label={t('下班疲惫回血/报复性刷手机 (分钟/天)', 'Daily Decompression Time (mins)')}
                  value={decompressionInput}
                  onChangeText={setDecompressionInput}
                  placeholder="30"
                  keyboardType="number-pad"
                />
              </View>
            </Row>

            <Row justify="between" align="center" gap="sm" wrap>
              <Row gap="xs" align="center" wrap>
                <CockpitPillButton
                  label={
                    config.includePartnerInPool
                      ? t('✓ 已开启双人合池综合时薪', '✓ Couple Pool Rate Active')
                      : t('+ 开启双人合池综合时薪', '+ Enable Couple Pool Rate')
                  }
                  active={config.includePartnerInPool}
                  accessibilityLabel="切换双人合池综合时薪计算"
                  onPress={() =>
                    applyConfigPatch({
                      includePartnerInPool: !config.includePartnerInPool,
                    })
                  }
                />
                <Text variant="caption" tone="muted">
                  {t('深度学习复利倍率:', 'Focus Multiplier:')}
                </Text>
                {MULTIPLIER_PRESETS.map((mult) => (
                  <CockpitPillButton
                    key={mult}
                    label={`${mult.toFixed(1)}×`}
                    active={config.focusCompoundMultiplier === mult}
                    accessibilityLabel={`设置深度学习复利倍率为 ${mult} 倍`}
                    onPress={() => applyConfigPatch({ focusCompoundMultiplier: mult })}
                  />
                ))}
              </Row>

              <Button
                label={t('保存并更新全站时间定价', 'Save & Update Time Pricing')}
                variant="primary"
                onPress={handleSaveBaseline}
              />
            </Row>

            {breakdown.nominalHourlyCny > 0 ? (
              <View style={[styles.insightStrip, { backgroundColor: color.accentSoft }]}>
                <Row justify="between" align="center" wrap>
                  <Text variant="caption">
                    {t(
                      `🔍 隐形工时诊断：每月名义工作 ${breakdown.nominalMonthlyHours.toFixed(0)}h，但通勤+加班+回血额外吞噬了 ${breakdown.hiddenMonthlyHours.toFixed(0)}h（占总生命付出 ${breakdown.hiddenHoursRatioPct}%），导致真实时薪比账面少 ¥${breakdown.hourlyDragCny.toFixed(1)}/h。`,
                      `🔍 Hidden Drag: ${breakdown.hiddenMonthlyHours.toFixed(0)}h/mo spent on commute, overtime & recovery (${breakdown.hiddenHoursRatioPct}% of work life), reducing hourly rate by ¥${breakdown.hourlyDragCny.toFixed(1)}/h.`,
                    )}
                  </Text>
                </Row>
                <ProgressBar
                  value={Math.min(1, Math.max(0.05, breakdown.effectiveRetentionPct / 100))}
                  masked={false}
                />
              </View>
            ) : null}
          </Stack>
        </View>

        {/* 3. Interactive "Buy Time vs. Save Money (+EV)" Decision Engine */}
        <View style={[styles.sectionBox, cardSurfaceStyle(color.surface, color.line)]}>
          <Stack gap="sm">
            <Row justify="between" align="center" wrap>
              <Stack gap="xs">
                <Text variant="label">
                  {t(
                    '2. 「花钱买时间」ROI 决策器（+EV 正期望值测算）',
                    '2. "Buy Time vs. Save Money" (+EV) Decision Calculator',
                  )}
                </Text>
                <Text variant="caption" tone="muted">
                  {t(
                    '纠结要不要打车、请保洁、买效率工具？只要「买下 1 小时的花销 < 你的真实时薪」，这笔钱就是净赚时间价值的 +EV 投资',
                    'Whenever cost per hour saved is below your True Net Hourly Rate, buying time is a +EV decision',
                  )}
                </Text>
              </Stack>
              <TagChip
                label={buyDecision.verdictZh}
                tone={buyDecision.isPositiveEv ? 'exec' : 'owner'}
              />
            </Row>

            {/* Preset Scenario Cards */}
            <View style={styles.presetGrid}>
              {BUY_TIME_PRESET_SCENARIOS.map((sc) => {
                const ev = evaluateBuyTimeDecision({
                  costCny: sc.costCny,
                  savedMinutes: sc.savedMinutes,
                  trueNetHourlyCny: breakdown.trueNetHourlyCny,
                  focusCompoundHourlyCny: breakdown.focusCompoundHourlyCny,
                  useCompoundRate: sc.useCompoundRate,
                });
                const isSelected =
                  Number(buyCostInput) === sc.costCny &&
                  Number(buySavedMinsInput) === sc.savedMinutes;
                return (
                  <Pressable
                    key={sc.id}
                    accessibilityRole="button"
                    accessibilityLabel={`测算场景 ${sc.titleZh}`}
                    onPress={() => {
                      setBuyCostInput(String(sc.costCny));
                      setBuySavedMinsInput(String(sc.savedMinutes));
                      setBuyUseCompound(sc.useCompoundRate);
                    }}
                    style={[
                      styles.presetCard,
                      cardSurfaceStyle(color.surface, isSelected ? color.accent : color.line),
                    ]}
                  >
                    <Row justify="between" align="center">
                      <Text variant="label">{t(sc.titleZh, sc.titleEn)}</Text>
                      <TagChip
                        label={
                          breakdown.trueNetHourlyCny <= 0
                            ? `¥${Math.round((sc.costCny / sc.savedMinutes) * 60)}/h`
                            : ev.isPositiveEv
                              ? `+EV 净赚 ¥${ev.netEvCny.toFixed(0)}`
                              : `-EV 溢价`
                        }
                        tone={ev.isPositiveEv ? 'exec' : 'pod'}
                      />
                    </Row>
                    <Text variant="caption" tone="muted">
                      {t(sc.subtitleZh, sc.subtitleEn)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Custom Buy-Time Inputs */}
            <Row gap="sm" align="center" wrap>
              <View style={{ flex: 1, minWidth: 140 }}>
                <TextField
                  label={t('多花的金额 (¥)', 'Extra Cost (¥)')}
                  value={buyCostInput}
                  onChangeText={setBuyCostInput}
                  placeholder="38"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1, minWidth: 140 }}>
                <TextField
                  label={t('省下的时间 (分钟)', 'Time Saved (mins)')}
                  value={buySavedMinsInput}
                  onChangeText={setBuySavedMinsInput}
                  placeholder="45"
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1.5, minWidth: 220 }}>
                <Stack gap="xs">
                  <Text variant="caption" tone="muted">
                    {t('省下的时间用途:', 'Saved Time Usage:')}
                  </Text>
                  <Row gap="xs" wrap>
                    <CockpitPillButton
                      label={t('日常休息/免排队 (按净时薪)', 'Rest / Skip Queue (Net Rate)')}
                      active={!buyUseCompound}
                      accessibilityLabel="按真实净时薪评估省下的时间"
                      onPress={() => setBuyUseCompound(false)}
                    />
                    <CockpitPillButton
                      label={t('深度创造/学习 (按复利时薪)', 'Deep Focus / Study (Compound)')}
                      active={buyUseCompound}
                      accessibilityLabel="按深度创造复利时薪评估省下的时间"
                      onPress={() => setBuyUseCompound(true)}
                    />
                  </Row>
                </Stack>
              </View>
            </Row>

            <View
              style={[
                styles.verdictBanner,
                {
                  backgroundColor: buyDecision.isPositiveEv ? color.greenSoft : color.accentSoft,
                  borderColor: buyDecision.isPositiveEv ? color.green : color.line,
                },
              ]}
            >
              <Row justify="between" align="center" wrap>
                <Text variant="label">{buyDecision.verdictZh}</Text>
                <Text variant="caption" tone="muted">
                  {`省下时间价值 ¥${buyDecision.timeValueSavedCny.toFixed(1)} vs 支出 ¥${buyDecision.costCny.toFixed(1)}`}
                </Text>
              </Row>
              <Text variant="caption">{buyDecision.detailZh}</Text>
            </View>
          </Stack>
        </View>

        {/* 4. Expense-to-Life-Hours Price Tag Converter & Today's Time-Value Ledger */}
        <View style={styles.splitRow}>
          {/* Left: Expense Life-Hours Price Tag */}
          <View style={[styles.halfCard, cardSurfaceStyle(color.surface, color.line)]}>
            <Stack gap="xs">
              <Row justify="between" align="center">
                <Text variant="label">
                  {t('3. 消费折算「真实生命工时」标价器', '3. Expense-to-Life-Hours Converter')}
                </Text>
                <TagChip label={itemLifeHours.labelZh} tone="owner" />
              </Row>
              <Text variant="caption" tone="muted">
                {t(
                  '买一件商品前，先看它需要消耗你多少小时的真实生命（含通勤与加班）',
                  'See how many real working hours an item costs before buying',
                )}
              </Text>
              <Row gap="xs" align="center" wrap>
                <View style={{ flex: 1, minWidth: 140 }}>
                  <TextField
                    label={t('想买的商品价格 (¥)', 'Item Price (¥)')}
                    value={itemPriceInput}
                    onChangeText={setItemPriceInput}
                    placeholder="1299"
                    keyboardType="decimal-pad"
                  />
                </View>
                {[68, 299, 1299, 5999, 12999].map((price) => (
                  <CockpitPillButton
                    key={price}
                    label={`¥${price}`}
                    active={Number(itemPriceInput) === price}
                    accessibilityLabel={`测算 ${price} 元商品对应的生命工时`}
                    onPress={() => setItemPriceInput(String(price))}
                  />
                ))}
              </Row>
              <Text variant="body">
                {breakdown.trueNetHourlyCny > 0
                  ? `💡 消费 ¥${Number(itemPriceInput || 0).toLocaleString()} = 真实搬砖 ${itemLifeHours.totalHours.toFixed(1)} 小时（约 ${itemLifeHours.workDaysEquivalent} 个含通勤加班的真实工作日）`
                  : '💡 请先在上方点选或输入税后月薪，即可自动换算任意商品的生命工时价格'}
              </Text>
            </Stack>
          </View>

          {/* Right: Today's 24H Time-Value Bill */}
          <View style={[styles.halfCard, cardSurfaceStyle(color.surface, color.line)]}>
            <Stack gap="xs">
              <Row justify="between" align="center">
                <Text variant="label">
                  {t('4. 今日 24H 时间价值账单（与时间块联动）', '4. Today 24H Time-Value Ledger')}
                </Text>
                <TagChip
                  label={`+¥${dailyValueLedger.totalValueCreatedCny.toFixed(1)}`}
                  tone="exec"
                />
              </Row>
              <Text variant="caption" tone="muted">
                {dailyValueLedger.headlineZh}
              </Text>
              <Row gap="xs" wrap>
                <TagChip
                  label={`学习精进 ${dailyValueLedger.studyMinutes}m`}
                  tone="owner"
                />
                <TagChip
                  label={`深度创造 ${dailyValueLedger.deepWorkMinutes}m`}
                  tone="pod"
                />
                <TagChip
                  label={`体能训练 ${dailyValueLedger.fitnessMinutes}m`}
                  tone="exec"
                />
                <TagChip
                  label={`日常事务 ${dailyValueLedger.lifeMinutes}m`}
                  tone="pod"
                />
              </Row>
              <Text variant="caption" tone="muted">
                {t(
                  '提示：在「24H 时间块」开启实时专注计时器时，界面会每秒实时跳动本次专注为你创造的 ¥ 复利价值。',
                  'Tip: Start the Live Focus Timer in 24H Time-Blocks to watch your real-time ¥ value tick every second.',
                )}
              </Text>
            </Stack>
          </View>
        </View>
      </Stack>
    </Card>
  );
}

const styles = StyleSheet.create({
  heroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  heroCard: {
    flex: 1,
    minWidth: 230,
    padding: theme.space.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: 6,
  },
  heroNumber: {
    fontFamily: theme.fontFamily.mono,
    fontSize: 28,
    fontWeight: '700',
    marginVertical: 2,
  },
  sectionBox: {
    padding: theme.space.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  fieldCol: {
    flex: 1,
    minWidth: 180,
  },
  insightStrip: {
    padding: theme.space.sm,
    borderRadius: theme.radius.sm,
    gap: 6,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.xs,
  },
  presetCard: {
    flex: 1,
    minWidth: 210,
    padding: theme.space.sm,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: 4,
  },
  verdictBanner: {
    padding: theme.space.sm,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: 4,
  },
  splitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  halfCard: {
    flex: 1,
    minWidth: 260,
    padding: theme.space.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
});
