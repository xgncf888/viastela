import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';

import {
  type BookkeepingState,
  computeAccountBalances,
  computeCategoryBreakdown,
  computeDailySpendBars,
  computeMonthlyBookkeepingSummary,
  evaluateAmountExpression,
  formatLedgerCsv,
  getLedgerAccountMeta,
  getLedgerCategoryMeta,
  LEDGER_ACCOUNTS,
  LEDGER_CATEGORIES,
  type LedgerAccountId,
  type LedgerCategoryId,
  type LedgerEntryKind,
  type LedgerTransaction,
  parseQuickBookkeepingInput,
  QUICK_LEDGER_PRESETS,
  type QuickLedgerPreset,
} from '@/core/bookkeeping';
import { formatMonthDay, weekdayLabel } from '@/core/local-day';
import {
  addLedgerTransaction,
  readBookkeepingState,
  removeLedgerTransaction,
  subscribeBookkeepingStore,
  updateMonthlyBudgetCny,
} from '@/data/bookkeeping';
import { recordPledgeReward } from '@/data/life-gamification';

import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import { showToast } from './toast';
import { useI18n } from './use-i18n';

function playCashRegisterTick(kind: 'expense' | 'income' | 'undo' = 'expense') {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const AudioCtx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind === 'income' ? 'sine' : 'triangle';
    if (kind === 'income') {
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.16);
    } else if (kind === 'undo') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(310, now + 0.06);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.08);
    } else {
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.05);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.075);
    }
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 240);
  } catch {
    // Ignore audio context restrictions
  }
}

export function BookkeepingLedgerHub({
  localDay,
  compact = false,
}: {
  localDay: string;
  compact?: boolean;
}) {
  const { scheme } = useTheme();
  const { t } = useI18n();
  const isDark = scheme === 'dark';

  const [state, setState] = useState<BookkeepingState>(readBookkeepingState);
  const [entryKind, setEntryKind] = useState<LedgerEntryKind>('expense');
  const [selectedCategory, setSelectedCategory] = useState<LedgerCategoryId>('dining');
  const [selectedAccount, setSelectedAccount] = useState<LedgerAccountId>('wechat');
  const [amountInput, setAmountInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [smartInput, setSmartInput] = useState('');
  const [lastAddedTxId, setLastAddedTxId] = useState<string | null>(null);

  // Filters & Budget Editor
  const [filterCat, setFilterCat] = useState<LedgerCategoryId | 'all'>('all');
  const [filterAcc, setFilterAcc] = useState<LedgerAccountId | 'all'>('all');
  const [filterDay, setFilterDay] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState(String(state.monthlyBudgetCny));

  useEffect(() => {
    return subscribeBookkeepingStore(() => {
      setState(readBookkeepingState());
    });
  }, []);

  const pal = isDark
    ? {
        bg: '#121110',
        cardBg: '#18181b',
        cardElevated: '#1f1e22',
        border: 'rgba(255, 255, 255, 0.10)',
        goldBorder: 'rgba(245, 185, 66, 0.35)',
        ink: '#f8fafc',
        sub: '#cbd5e1',
        muted: '#94a3b8',
        gold: '#f5b942',
        goldText: '#fde68a',
        emerald: '#34d399',
        terracotta: '#f59e0b',
        danger: '#f87171',
        pillBg: 'rgba(255, 255, 255, 0.06)',
        pillActiveBg: 'rgba(245, 185, 66, 0.18)',
        inputBg: 'rgba(12, 10, 9, 0.72)',
      }
    : {
        bg: '#f5f2eb',
        cardBg: '#ffffff',
        cardElevated: '#faf8f3',
        border: 'rgba(38, 36, 31, 0.11)',
        goldBorder: 'rgba(184, 130, 40, 0.36)',
        ink: '#26241f',
        sub: '#524e46',
        muted: '#7a756c',
        gold: '#b88228',
        goldText: '#92560c',
        emerald: '#1f5e4b',
        terracotta: '#cc785c',
        danger: '#dc2626',
        pillBg: 'rgba(38, 36, 31, 0.05)',
        pillActiveBg: 'rgba(204, 120, 92, 0.15)',
        inputBg: '#f4f1ea',
      };

  const summary = useMemo(
    () => computeMonthlyBookkeepingSummary(state, localDay),
    [state, localDay],
  );
  const categoryBreakdown = useMemo(
    () => computeCategoryBreakdown(state.transactions, summary.yearMonth, 'expense'),
    [state.transactions, summary.yearMonth],
  );
  const dailyBars = useMemo(
    () => computeDailySpendBars(state.transactions, localDay, 14),
    [state.transactions, localDay],
  );
  const accountBalances = useMemo(
    () => computeAccountBalances(state.transactions),
    [state.transactions],
  );

  const visibleCategories = useMemo(
    () => LEDGER_CATEGORIES.filter((c) => c.kind === entryKind),
    [entryKind],
  );

  // Filtered transactions grouped by localDay
  const groupedDays = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = state.transactions.filter((tx) => {
      if (filterCat !== 'all' && tx.categoryId !== filterCat) return false;
      if (filterAcc !== 'all' && tx.accountId !== filterAcc) return false;
      if (filterDay && tx.localDay !== filterDay) return false;
      if (q) {
        const cat = getLedgerCategoryMeta(tx.categoryId);
        const acc = getLedgerAccountMeta(tx.accountId);
        const hay = `${tx.note} ${cat.zh} ${cat.en} ${acc.zh} ${acc.en} ${tx.amountCny}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const map = new Map<
      string,
      { localDay: string; expenseCny: number; incomeCny: number; items: LedgerTransaction[] }
    >();
    for (const tx of filtered) {
      const existing = map.get(tx.localDay) ?? {
        localDay: tx.localDay,
        expenseCny: 0,
        incomeCny: 0,
        items: [],
      };
      if (tx.kind === 'expense') existing.expenseCny += tx.amountCny;
      else existing.incomeCny += tx.amountCny;
      existing.items.push(tx);
      map.set(tx.localDay, existing);
    }

    return [...map.values()].sort((a, b) => b.localDay.localeCompare(a.localDay));
  }, [state.transactions, filterCat, filterAcc, filterDay, searchQuery]);

  function handleSmartNaturalSubmit() {
    const parsed = parseQuickBookkeepingInput(smartInput, selectedCategory, selectedAccount);
    if (!parsed) {
      showToast({
        text: t(
          '请输入包含金额的内容，例如「瑞幸咖啡 18」或「午饭 35 微信」',
          'Include an amount, e.g. "Coffee 18" or "Lunch 35"',
        ),
        tone: 'error',
      });
      return;
    }
    const { state: next, added } = addLedgerTransaction({
      ...parsed,
      localDay: filterDay ?? localDay,
    });
    setState(next);
    setLastAddedTxId(added.id);
    setSmartInput('');
    playCashRegisterTick(parsed.kind);
    recordPledgeReward(`记账打卡：${parsed.note} ¥${parsed.amountCny}`, localDay, 10);
    const cat = getLedgerCategoryMeta(parsed.categoryId);
    showToast({
      text: t(
        `✓ 已智能记账：${cat.icon} ${parsed.note} ${parsed.kind === 'expense' ? '-' : '+'}¥${parsed.amountCny.toFixed(2)}`,
        `✓ Logged: ${cat.icon} ${parsed.note} ${parsed.kind === 'expense' ? '-' : '+'}¥${parsed.amountCny.toFixed(2)}`,
      ),
    });
  }

  function handlePresetOneTap(preset: QuickLedgerPreset) {
    const { state: next, added } = addLedgerTransaction({
      kind: 'expense',
      amountCny: preset.amountCny,
      categoryId: preset.categoryId,
      accountId: preset.accountId,
      note: t(preset.zh, preset.en),
      localDay: filterDay ?? localDay,
    });
    setState(next);
    setLastAddedTxId(added.id);
    playCashRegisterTick('expense');
    recordPledgeReward(`闪记：${preset.zh}`, localDay, 10);
    showToast({
      text: t(
        `⚡ 一键记账：${preset.icon} ${preset.zh} -¥${preset.amountCny}（可点右侧 ↺ 撤回）`,
        `⚡ 1-Tap Logged: ${preset.icon} ${preset.en} -¥${preset.amountCny}`,
      ),
    });
  }

  function handleKeypadFormSubmit() {
    const amountCny = evaluateAmountExpression(amountInput);
    if (!amountCny || amountCny <= 0) {
      showToast({
        text: t('请输入有效金额（支持 35+18 直接算式）', 'Enter a valid amount (e.g., 35+18)'),
        tone: 'error',
      });
      return;
    }
    const cat = getLedgerCategoryMeta(selectedCategory);
    const cleanNote = noteInput.trim() || t(cat.zh, cat.en);
    const { state: next, added } = addLedgerTransaction({
      kind: entryKind,
      amountCny,
      categoryId: selectedCategory,
      accountId: selectedAccount,
      note: cleanNote,
      localDay: filterDay ?? localDay,
    });
    setState(next);
    setLastAddedTxId(added.id);
    setAmountInput('');
    setNoteInput('');
    playCashRegisterTick(entryKind);
    recordPledgeReward(`记账：${cleanNote}`, localDay, 10);
    showToast({
      text: t(
        `✓ 已记入账本：${cat.icon} ${cleanNote} ${entryKind === 'expense' ? '-' : '+'}¥${amountCny.toFixed(2)}`,
        `✓ Saved: ${cat.icon} ${cleanNote} ${entryKind === 'expense' ? '-' : '+'}¥${amountCny.toFixed(2)}`,
      ),
    });
  }

  function handleUndoLastTx() {
    if (!lastAddedTxId) return;
    const next = removeLedgerTransaction(lastAddedTxId);
    setState(next);
    setLastAddedTxId(null);
    playCashRegisterTick('undo');
    showToast({ text: t('↺ 已撤回刚才记下的那一笔账单', '↺ Undid last transaction') });
  }

  function handleSaveBudget() {
    const num = Number.parseInt(budgetDraft, 10);
    if (Number.isFinite(num) && num >= 100) {
      const next = updateMonthlyBudgetCny(num);
      setState(next);
      setBudgetDraft(String(next.monthlyBudgetCny));
      showToast({
        text: t(`✓ 本月预算已更新为 ¥${next.monthlyBudgetCny.toLocaleString('en-US')}`, `✓ Monthly budget set to ¥${next.monthlyBudgetCny.toLocaleString('en-US')}`),
      });
    }
    setEditingBudget(false);
  }

  async function handleExportCsv() {
    const csv = formatLedgerCsv(state.transactions);
    const filename = `viastela-ledger-${localDay}.csv`;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast({ text: t(`✓ 已导出账单明细 ${filename}`, `✓ Exported ${filename}`) });
        return;
      } catch {
        // Fallback below
      }
    }
    try {
      await Share.share({ title: filename, message: csv });
    } catch {
      showToast({ text: t('导出未完成', 'Export failed'), tone: 'error' });
    }
  }

  const evaluatedPreview = useMemo(() => evaluateAmountExpression(amountInput), [amountInput]);

  return (
    <View style={[styles.container, { backgroundColor: pal.bg, borderColor: pal.goldBorder }]}>
      {/* 1. Top Monthly Budget & Safe-to-Spend Cockpit Header */}
      <View style={[styles.topCockpit, { backgroundColor: pal.cardElevated, borderBottomColor: pal.border }]}>
        <View style={styles.topMetricsRow}>
          {/* Metric 1: Monthly Expense & Budget Progress */}
          <View style={[styles.metricCard, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
            <View style={styles.metricHeaderRow}>
              <Text variant="caption" style={{ color: pal.muted, fontSize: 11 }}>
                {t(`${summary.yearMonth} 本月支出`, `${summary.yearMonth} Month Spend`)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="修改本月预算额度"
                onPress={() => {
                  setBudgetDraft(String(summary.monthlyBudgetCny));
                  setEditingBudget((prev) => !prev);
                }}
              >
                <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                  {t(`预算 ¥${summary.monthlyBudgetCny.toLocaleString('en-US')} ✎`, `Budget ¥${summary.monthlyBudgetCny.toLocaleString('en-US')} ✎`)}
                </Text>
              </Pressable>
            </View>
            {editingBudget ? (
              <View style={styles.inlineBudgetEditRow}>
                <TextInput
                  value={budgetDraft}
                  onChangeText={setBudgetDraft}
                  onSubmitEditing={handleSaveBudget}
                  placeholder="6000"
                  placeholderTextColor={pal.muted}
                  style={[
                    styles.budgetInput,
                    { backgroundColor: pal.inputBg, borderColor: pal.gold, color: pal.ink },
                  ]}
                />
                <Pressable
                  onPress={handleSaveBudget}
                  style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
                >
                  <Text variant="caption" style={{ color: pal.goldText, fontWeight: '700', fontSize: 10.5 }}>
                    {t('保存', 'Save')}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Text variant="title" style={[styles.bigAmountText, { color: pal.ink }]}>
                {`¥${summary.totalExpenseCny.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </Text>
            )}
            <View style={[styles.budgetProgressTrack, { backgroundColor: pal.pillBg }]}>
              <View
                style={[
                  styles.budgetProgressFill,
                  {
                    width: `${Math.min(100, Math.max(4, summary.budgetUsedPct))}%`,
                    backgroundColor: summary.isOverBudget ? pal.danger : summary.budgetUsedPct > 80 ? pal.terracotta : pal.emerald,
                  },
                ]}
              />
            </View>
            <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5 }}>
              {summary.isOverBudget
                ? t(`⚠️ 已超支 ¥${Math.abs(summary.remainingBudgetCny).toLocaleString('en-US')}`, `⚠️ Over budget by ¥${Math.abs(summary.remainingBudgetCny).toLocaleString('en-US')}`)
                : t(
                    `已用 ${summary.budgetUsedPct}% · 剩余预算 ¥${summary.remainingBudgetCny.toLocaleString('en-US')}`,
                    `${summary.budgetUsedPct}% used · ¥${summary.remainingBudgetCny.toLocaleString('en-US')} left`,
                  )}
            </Text>
          </View>

          {/* Metric 2: Daily Safe-to-Spend Quota (今日可花额度) */}
          <View style={[styles.metricCard, { backgroundColor: pal.cardBg, borderColor: pal.goldBorder }]}>
            <View style={styles.metricHeaderRow}>
              <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontWeight: '700' }}>
                {t('✦ 今日安全可花额度', '✦ Safe-to-Spend Today')}
              </Text>
              <Text variant="caption" style={{ color: pal.muted, fontSize: 10.5 }}>
                {t(`余 ${summary.daysLeftInMonth} 天`, `${summary.daysLeftInMonth}d left`)}
              </Text>
            </View>
            <Text variant="title" style={[styles.bigAmountText, { color: pal.goldText }]}>
              {`¥${summary.dailySafeToSpendCny.toLocaleString('en-US')}`}
            </Text>
            <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5 }}>
              {t(
                `今日已花 ¥${summary.todayExpenseCny.toFixed(2)} · ${
                  summary.todayExpenseCny <= summary.dailySafeToSpendCny
                    ? '节奏稳健 ✓'
                    : '今日略超额'
                }`,
                `Today spent ¥${summary.todayExpenseCny.toFixed(2)}`,
              )}
            </Text>
          </View>

          {/* Metric 3: Monthly Income & Net Savings */}
          <View style={[styles.metricCard, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
            <View style={styles.metricHeaderRow}>
              <Text variant="caption" style={{ color: pal.muted, fontSize: 11 }}>
                {t('本月收入与净结余', 'Monthly Income & Net')}
              </Text>
              <Pressable onPress={() => void handleExportCsv()}>
                <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, fontWeight: '700' }}>
                  {t('📥 导出 CSV', '📥 Export CSV')}
                </Text>
              </Pressable>
            </View>
            <Text variant="title" style={[styles.bigAmountText, { color: pal.emerald }]}>
              {`+¥${summary.totalIncomeCny.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </Text>
            <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5 }}>
              {t(
                `本月净结余 ${summary.netCashflowCny >= 0 ? '+' : ''}¥${summary.netCashflowCny.toLocaleString('en-US')}`,
                `Net savings ${summary.netCashflowCny >= 0 ? '+' : ''}¥${summary.netCashflowCny.toLocaleString('en-US')}`,
              )}
            </Text>
          </View>
        </View>

        {/* 1-Second Natural Language Bar + 1-Tap High-Frequency Presets */}
        <View style={styles.smartBarRow}>
          <View style={styles.smartInputCluster}>
            <TextInput
              value={smartInput}
              onChangeText={setSmartInput}
              onSubmitEditing={handleSmartNaturalSubmit}
              placeholder={t(
                '⚡ 一句话智能记账（如：瑞幸拿铁 18 微信 / 盒马买菜 86 支付宝 / 工资 +25000）…',
                '⚡ Smart Log (e.g. Latte 18 WeChat / Groceries 86 Alipay / Salary +25000)…',
              )}
              placeholderTextColor={pal.muted}
              style={[
                styles.smartInput,
                { backgroundColor: pal.inputBg, borderColor: pal.goldBorder, color: pal.ink },
                Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : null,
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="一句话智能记账入账"
              onPress={handleSmartNaturalSubmit}
              style={({ pressed }) => [
                styles.smartSubmitBtn,
                {
                  backgroundColor: pal.pillActiveBg,
                  borderColor: pal.gold,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
            >
              <Text variant="caption" style={{ color: pal.goldText, fontWeight: '700', fontSize: 11.5 }}>
                {t('⚡ 秒记入账', '⚡ Instant Log')}
              </Text>
            </Pressable>
            {lastAddedTxId ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="撤回上一笔账单"
                onPress={handleUndoLastTx}
                style={({ pressed }) => [
                  styles.smartSubmitBtn,
                  {
                    backgroundColor: pal.pillBg,
                    borderColor: pal.border,
                    transform: [{ scale: pressed ? 0.94 : 1 }],
                  },
                ]}
              >
                <Text variant="caption" style={{ color: pal.sub, fontWeight: '600', fontSize: 11 }}>
                  {t('↺ 撤回上笔', '↺ Undo')}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* 1-Tap High-Frequency Expense Capsules */}
          <View style={styles.presetRow}>
            <Text variant="caption" style={{ color: pal.muted, fontSize: 10.5 }}>
              {t('一键闪记：', '1-Tap:')}
            </Text>
            {QUICK_LEDGER_PRESETS.map((preset) => (
              <Pressable
                key={preset.id}
                accessibilityRole="button"
                accessibilityLabel={`一键闪记 ${preset.zh} ${preset.amountCny}元`}
                onPress={() => handlePresetOneTap(preset)}
                style={({ pressed }) => [
                  styles.presetChip,
                  {
                    backgroundColor: pal.pillBg,
                    borderColor: pal.border,
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                  },
                ]}
              >
                <Text variant="caption" style={{ color: pal.ink, fontSize: 11, fontWeight: '600' }}>
                  {`${preset.icon} ${t(preset.zh, preset.en)} `}
                  <Text variant="caption" style={{ color: pal.goldText, fontWeight: '700', fontSize: 11 }}>
                    {`¥${preset.amountCny}`}
                  </Text>
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* 2. Main Split Workspace: Left Interactive Category Keypad & Right Analytics/Stream */}
      {!compact ? (
        <View style={styles.mainSplitGrid}>
          {/* Left Column: Visual Category Grid + Built-in Calculator Keypad */}
          <View style={[styles.leftPanelCard, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
            <View style={styles.sectionTitleRow}>
              <Text variant="label" style={{ color: pal.ink, fontSize: 13.5, fontWeight: '700' }}>
                {t('分类记账键盘', 'Category & Calculator Pad')}
              </Text>
              <View style={[styles.kindSwitchPill, { backgroundColor: pal.pillBg }]}>
                <Pressable
                  onPress={() => {
                    setEntryKind('expense');
                    setSelectedCategory('dining');
                  }}
                  style={[
                    styles.kindSwitchBtn,
                    entryKind === 'expense' ? { backgroundColor: pal.terracotta } : null,
                  ]}
                >
                  <Text
                    variant="caption"
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: entryKind === 'expense' ? '#ffffff' : pal.sub,
                    }}
                  >
                    {t('支出', 'Expense')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setEntryKind('income');
                    setSelectedCategory('salary');
                  }}
                  style={[
                    styles.kindSwitchBtn,
                    entryKind === 'income' ? { backgroundColor: pal.emerald } : null,
                  ]}
                >
                  <Text
                    variant="caption"
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: entryKind === 'income' ? '#ffffff' : pal.sub,
                    }}
                  >
                    {t('收入', 'Income')}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Category Icon Matrix */}
            <View style={styles.categoryGrid}>
              {visibleCategories.map((cat) => {
                const active = selectedCategory === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    accessibilityRole="button"
                    accessibilityLabel={`选择分类 ${cat.zh}`}
                    onPress={() => setSelectedCategory(cat.id)}
                    style={({ pressed }) => [
                      styles.categoryCell,
                      {
                        backgroundColor: active ? `${cat.color}22` : pal.pillBg,
                        borderColor: active ? cat.color : pal.border,
                        transform: [{ scale: pressed ? 0.94 : 1 }],
                      },
                    ]}
                  >
                    <Text variant="body" style={{ fontSize: 16 }}>
                      {cat.icon}
                    </Text>
                    <Text
                      variant="caption"
                      style={{
                        fontSize: 11,
                        fontWeight: active ? '700' : '500',
                        color: active ? pal.ink : pal.sub,
                      }}
                    >
                      {t(cat.zh, cat.en)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Payment Account Selector */}
            <View style={styles.accountSelectorRow}>
              {LEDGER_ACCOUNTS.map((acc) => {
                const active = selectedAccount === acc.id;
                return (
                  <Pressable
                    key={acc.id}
                    onPress={() => setSelectedAccount(acc.id)}
                    style={({ pressed }) => [
                      styles.accountChip,
                      {
                        backgroundColor: active ? `${acc.color}22` : pal.pillBg,
                        borderColor: active ? acc.color : pal.border,
                        transform: [{ scale: pressed ? 0.94 : 1 }],
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={{
                        fontSize: 10.5,
                        fontWeight: active ? '700' : '500',
                        color: active ? pal.ink : pal.sub,
                      }}
                    >
                      {`${acc.icon} ${t(acc.zh, acc.en)}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Amount & Note Input Row */}
            <View style={styles.keypadInputBox}>
              <View style={styles.amountInputRow}>
                <Text variant="title" style={{ color: pal.goldText, fontSize: 18, fontWeight: '700' }}>
                  ¥
                </Text>
                <TextInput
                  value={amountInput}
                  onChangeText={setAmountInput}
                  onSubmitEditing={handleKeypadFormSubmit}
                  placeholder={t('输入金额或算式 (如 35+18)', 'Amount or math (e.g. 35+18)')}
                  placeholderTextColor={pal.muted}
                  style={[
                    styles.amountField,
                    { color: pal.ink, backgroundColor: pal.inputBg, borderColor: pal.border },
                    Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : null,
                  ]}
                />
                {evaluatedPreview && amountInput.includes('+') ? (
                  <Text variant="caption" style={{ color: pal.emerald, fontWeight: '700', fontSize: 11.5 }}>
                    {`= ¥${evaluatedPreview}`}
                  </Text>
                ) : null}
              </View>
              <View style={styles.amountInputRow}>
                <TextInput
                  value={noteInput}
                  onChangeText={setNoteInput}
                  onSubmitEditing={handleKeypadFormSubmit}
                  placeholder={t('添加备注（可选，默认分类名）…', 'Note (optional)…')}
                  placeholderTextColor={pal.muted}
                  style={[
                    styles.noteField,
                    { color: pal.ink, backgroundColor: pal.inputBg, borderColor: pal.border },
                    Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : null,
                  ]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="保存该笔账单"
                  onPress={handleKeypadFormSubmit}
                  style={({ pressed }) => [
                    styles.saveLedgerBtn,
                    {
                      backgroundColor: entryKind === 'expense' ? pal.terracotta : pal.emerald,
                      transform: [{ scale: pressed ? 0.95 : 1 }],
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>
                    {t('✓ 记一笔', '✓ Save')}
                  </Text>
                </Pressable>
              </View>

              {/* Quick Calculator Number Pad Pills */}
              <View style={styles.quickCalcRow}>
                {['15', '25', '38', '68', '100', '+10', '+50', 'C'].map((tok) => (
                  <Pressable
                    key={tok}
                    onPress={() => {
                      if (tok === 'C') setAmountInput('');
                      else if (tok.startsWith('+')) {
                        setAmountInput((prev) => (prev ? `${prev}${tok}` : tok.slice(1)));
                      } else {
                        setAmountInput(tok);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.calcKeyBtn,
                      {
                        backgroundColor: pal.pillBg,
                        borderColor: pal.border,
                        transform: [{ scale: pressed ? 0.92 : 1 }],
                      },
                    ]}
                  >
                    <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5, fontWeight: '600' }}>
                      {tok}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Account Wallet Balances */}
            <View style={styles.walletSection}>
              <Text variant="caption" style={{ color: pal.muted, fontSize: 11, fontWeight: '600' }}>
                {t('💳 账户资金结余（点击按账户筛选）', '💳 Account Wallets (Tap to filter)')}
              </Text>
              <View style={styles.walletGrid}>
                {accountBalances.map(({ account, balanceCny, monthExpenseCny }) => {
                  const isFiltered = filterAcc === account.id;
                  return (
                    <Pressable
                      key={account.id}
                      onPress={() => setFilterAcc((prev) => (prev === account.id ? 'all' : account.id))}
                      style={[
                        styles.walletCard,
                        {
                          backgroundColor: isFiltered ? `${account.color}18` : pal.cardElevated,
                          borderColor: isFiltered ? account.color : pal.border,
                        },
                      ]}
                    >
                      <View style={styles.metricHeaderRow}>
                        <Text variant="caption" style={{ color: pal.ink, fontWeight: '700', fontSize: 11 }}>
                          {`${account.icon} ${t(account.zh, account.en)}`}
                        </Text>
                        <Text variant="caption" style={{ color: pal.muted, fontSize: 9.5 }}>
                          {`-¥${monthExpenseCny.toFixed(0)}`}
                        </Text>
                      </View>
                      <Text
                        variant="label"
                        style={{
                          color: pal.goldText,
                          fontFamily: theme.fontFamily.mono,
                          fontSize: 12.5,
                          fontWeight: '700',
                        }}
                      >
                        {`¥${balanceCny.toLocaleString('en-US')}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Right Column: 14-Day Spend Bars + Category Breakdown + Daily Transaction Stream */}
          <View style={styles.rightPanelStack}>
            {/* Top-Right Card: Category Breakdown + 14-Day Trend */}
            <View style={[styles.rightCard, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
              <View style={styles.sectionTitleRow}>
                <Text variant="label" style={{ color: pal.ink, fontSize: 13.5, fontWeight: '700' }}>
                  {t('📊 本月支出结构与近 14 日消费脉搏', '📊 Category Breakdown & 14-Day Spend Pulse')}
                </Text>
                {filterCat !== 'all' || filterAcc !== 'all' || filterDay ? (
                  <Pressable
                    onPress={() => {
                      setFilterCat('all');
                      setFilterAcc('all');
                      setFilterDay(null);
                    }}
                    style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
                  >
                    <Text variant="caption" style={{ color: pal.goldText, fontSize: 10 }}>
                      {t('✕ 清除筛选', '✕ Clear Filter')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Category Proportional Progress Bars */}
              <View style={styles.catBreakdownList}>
                {categoryBreakdown.slice(0, 5).map((item) => {
                  const isSelected = filterCat === item.category.id;
                  return (
                    <Pressable
                      key={item.category.id}
                      onPress={() =>
                        setFilterCat((prev) => (prev === item.category.id ? 'all' : item.category.id))
                      }
                      style={[
                        styles.catBreakdownRow,
                        isSelected ? { backgroundColor: pal.pillBg, borderRadius: 6 } : null,
                      ]}
                    >
                      <View style={styles.catBreakdownLeft}>
                        <Text variant="caption" style={{ color: pal.ink, fontSize: 11.5, fontWeight: '600' }}>
                          {`${item.category.icon} ${t(item.category.zh, item.category.en)}`}
                        </Text>
                        <Text variant="caption" style={{ color: pal.muted, fontSize: 10 }}>
                          {`${item.count} ${t('笔', 'tx')} · ${item.sharePct}%`}
                        </Text>
                      </View>
                      <View style={[styles.catBarTrack, { backgroundColor: pal.pillBg }]}>
                        <View
                          style={[
                            styles.catBarFill,
                            { width: `${Math.max(6, item.sharePct)}%`, backgroundColor: item.category.color },
                          ]}
                        />
                      </View>
                      <Text
                        variant="caption"
                        style={{
                          width: 68,
                          textAlign: 'right',
                          color: pal.ink,
                          fontFamily: theme.fontFamily.mono,
                          fontWeight: '700',
                          fontSize: 11,
                        }}
                      >
                        {`¥${item.amountCny.toFixed(0)}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 14-Day Interactive Spend Spark-Bars */}
              <View style={styles.dailyBarsWrap}>
                {dailyBars.map((bar) => {
                  const isSelected = filterDay === bar.localDay;
                  return (
                    <Pressable
                      key={bar.localDay}
                      onPress={() =>
                        setFilterDay((prev) => (prev === bar.localDay ? null : bar.localDay))
                      }
                      style={styles.dailyBarCol}
                    >
                      <View style={[styles.dailyBarTrack, { backgroundColor: pal.pillBg }]}>
                        <View
                          style={[
                            styles.dailyBarFill,
                            {
                              height: `${bar.heightPct}%`,
                              backgroundColor: isSelected
                                ? pal.gold
                                : bar.isToday
                                  ? pal.terracotta
                                  : bar.expenseCny > summary.dailySafeToSpendCny
                                    ? pal.danger
                                    : pal.emerald,
                            },
                          ]}
                        />
                      </View>
                      <Text
                        variant="caption"
                        style={{
                          fontSize: 9,
                          fontFamily: theme.fontFamily.mono,
                          color: isSelected || bar.isToday ? pal.goldText : pal.muted,
                          fontWeight: isSelected || bar.isToday ? '700' : '400',
                        }}
                      >
                        {bar.shortLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Bottom-Right Card: Daily Grouped Transaction Stream */}
            <View style={[styles.rightCard, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
              <View style={styles.sectionTitleRow}>
                <Text variant="label" style={{ color: pal.ink, fontSize: 13.5, fontWeight: '700' }}>
                  {t('🧾 收支流水明细', '🧾 Transaction Ledger')}
                </Text>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t('🔍 搜索账单备注或分类…', '🔍 Search transactions…')}
                  placeholderTextColor={pal.muted}
                  style={[
                    styles.searchField,
                    { backgroundColor: pal.inputBg, borderColor: pal.border, color: pal.ink },
                    Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : null,
                  ]}
                />
              </View>

              {groupedDays.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text variant="caption" style={{ color: pal.muted }}>
                    {t('暂无匹配的收支记录，可在上方一句话秒记或点击分类入账。', 'No matching transactions yet.')}
                  </Text>
                </View>
              ) : (
                <View style={styles.dayGroupsStack}>
                  {groupedDays.slice(0, 6).map((group) => (
                    <View
                      key={group.localDay}
                      style={[styles.dayGroupCard, { backgroundColor: pal.cardElevated, borderColor: pal.border }]}
                    >
                      <View style={[styles.dayGroupHeader, { borderBottomColor: pal.border }]}>
                        <Text variant="caption" style={{ color: pal.sub, fontWeight: '700', fontSize: 11 }}>
                          {`${formatMonthDay(group.localDay)} ${weekdayLabel(group.localDay).replace('星期', '周')}`}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          {group.expenseCny > 0 ? (
                            <Text variant="caption" style={{ color: pal.sub, fontFamily: theme.fontFamily.mono, fontSize: 10.5 }}>
                              {`${t('支', 'Out')} -¥${group.expenseCny.toFixed(2)}`}
                            </Text>
                          ) : null}
                          {group.incomeCny > 0 ? (
                            <Text variant="caption" style={{ color: pal.emerald, fontFamily: theme.fontFamily.mono, fontSize: 10.5 }}>
                              {`${t('收', 'In')} +¥${group.incomeCny.toFixed(2)}`}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      {group.items.map((tx) => {
                        const cat = getLedgerCategoryMeta(tx.categoryId);
                        const acc = getLedgerAccountMeta(tx.accountId);
                        return (
                          <View key={tx.id} style={styles.txRow}>
                            <View style={styles.txLeft}>
                              <View
                                style={[
                                  styles.txIconBadge,
                                  { backgroundColor: `${cat.color}20`, borderColor: `${cat.color}55` },
                                ]}
                              >
                                <Text variant="caption" style={{ fontSize: 13 }}>
                                  {cat.icon}
                                </Text>
                              </View>
                              <View style={{ gap: 1 }}>
                                <Text variant="caption" style={{ color: pal.ink, fontSize: 12, fontWeight: '600' }}>
                                  {tx.note}
                                </Text>
                                <Text variant="caption" style={{ color: pal.muted, fontSize: 10 }}>
                                  {`${t(cat.zh, cat.en)} · ${acc.icon} ${t(acc.zh, acc.en)}`}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.txRight}>
                              <Text
                                variant="label"
                                style={{
                                  fontFamily: theme.fontFamily.mono,
                                  fontSize: 12.5,
                                  fontWeight: '700',
                                  color: tx.kind === 'expense' ? pal.ink : pal.emerald,
                                }}
                              >
                                {`${tx.kind === 'expense' ? '-' : '+'}¥${tx.amountCny.toFixed(2)}`}
                              </Text>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`删除账单 ${tx.note}`}
                                onPress={() => {
                                  const next = removeLedgerTransaction(tx.id);
                                  setState(next);
                                  playCashRegisterTick('undo');
                                }}
                                style={[styles.deleteTxBtn, { backgroundColor: pal.pillBg }]}
                              >
                                <Text variant="caption" style={{ color: pal.muted, fontSize: 10 }}>
                                  ×
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  topCockpit: {
    padding: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  topMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: 215,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 11,
    borderWidth: 1,
    gap: 5,
  },
  metricHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  bigAmountText: {
    fontSize: 21,
    lineHeight: 26,
    fontFamily: theme.fontFamily.mono,
    fontWeight: '700',
  },
  budgetProgressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  budgetProgressFill: {
    height: '100%',
    borderRadius: 999,
  },
  inlineBudgetEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  budgetInput: {
    flex: 1,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    fontFamily: theme.fontFamily.mono,
    fontSize: 12,
  },
  smartBarRow: {
    gap: 8,
  },
  smartInputCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  smartInput: {
    flex: 1,
    minWidth: 240,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    fontSize: 12.5,
  },
  smartSubmitBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  mainSplitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 14,
    gap: 12,
  },
  leftPanelCard: {
    flex: 1,
    minWidth: 295,
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
    gap: 11,
  },
  rightPanelStack: {
    flex: 1.35,
    minWidth: 320,
    gap: 12,
  },
  rightCard: {
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  kindSwitchPill: {
    flexDirection: 'row',
    borderRadius: 7,
    padding: 2,
    gap: 2,
  },
  kindSwitchBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 5,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  categoryCell: {
    width: '31%',
    minWidth: 82,
    flexGrow: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  accountSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  accountChip: {
    flex: 1,
    minWidth: 105,
    paddingVertical: 5.5,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
  },
  keypadInputBox: {
    gap: 8,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountField: {
    flex: 1,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontFamily: theme.fontFamily.mono,
    fontSize: 14,
    fontWeight: '700',
  },
  noteField: {
    flex: 1,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 12,
  },
  saveLedgerBtn: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCalcRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  calcKeyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  walletSection: {
    paddingTop: 4,
    gap: 7,
  },
  walletGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  walletCard: {
    width: '47%',
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
  },
  catBreakdownList: {
    gap: 6,
  },
  catBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  catBreakdownLeft: {
    width: 128,
    gap: 1,
  },
  catBarTrack: {
    flex: 1,
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
  },
  catBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  dailyBarsWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 68,
    paddingTop: 8,
    paddingHorizontal: 4,
    gap: 4,
  },
  dailyBarCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    height: '100%',
  },
  dailyBarTrack: {
    flex: 1,
    width: '100%',
    maxWidth: 14,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  dailyBarFill: {
    width: '100%',
    borderRadius: 4,
  },
  searchField: {
    width: 185,
    height: 28,
    paddingHorizontal: 9,
    borderRadius: 7,
    borderWidth: 1,
    fontSize: 11,
  },
  emptyBox: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  dayGroupsStack: {
    gap: 9,
  },
  dayGroupCard: {
    borderRadius: 9,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dayGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  txIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteTxBtn: {
    width: 20,
    height: 20,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  microBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
});
