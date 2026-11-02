import { createElement, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';

import {
  type BookkeepingState,
  computeAccountBalances,
  computeCategoryBreakdown,
  computeDailySpendBars,
  computeMonthlyBookkeepingSummary,
  computeWealthGoalTrajectory,
  evaluateAmountExpression,
  formatLedgerCsv,
  getLedgerAccountMeta,
  getLedgerCategoryMeta,
  getOwnerBadgeMeta,
  LEDGER_ACCOUNTS,
  LEDGER_CATEGORIES,
  type LedgerAccountId,
  type LedgerCategoryId,
  type LedgerEntryKind,
  type LedgerOwnerId,
  type LedgerTransaction,
  parseAutoLogUrlParams,
  parseQuickBookkeepingInput,
  QUICK_LEDGER_PRESETS,
  type QuickLedgerPreset,
} from '@/core/bookkeeping';
import { formatMonthDay, weekdayLabel } from '@/core/local-day';
import {
  addLedgerTransaction,
  addRecurringLedgerRule,
  ensureRecurringRulesApplied,
  importPartnerBookkeepingJson,
  readBookkeepingState,
  removeLedgerTransaction,
  removeRecurringLedgerRule,
  subscribeBookkeepingStore,
  toggleRecurringLedgerRule,
  updateCoupleTeamProfile,
  updateMonthlyBudgetCny,
  updateWealthPlanConfig,
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

/**
 * Interactive SVG Compound Wealth Trajectory Chart (Principal vs Compound Total vs Goal Line)
 */
function WealthTrajectorySvg({
  points,
  targetWealthCny,
  isDark,
}: {
  points: readonly {
    monthOffset: number;
    yearMonth: string;
    label: string;
    principalCny: number;
    compoundWealthCny: number;
  }[];
  targetWealthCny: number;
  isDark: boolean;
}) {
  if (Platform.OS !== 'web' || points.length < 2) {
    return null;
  }

  const width = 620;
  const height = 172;
  const padL = 48;
  const padR = 18;
  const padT = 18;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxVal = Math.max(
    targetWealthCny * 1.08,
    ...points.map((p) => p.compoundWealthCny),
    100000,
  );
  const minVal = Math.min(...points.map((p) => p.principalCny), 0);
  const span = Math.max(1, maxVal - minVal);

  const toX = (idx: number) => padL + (idx / (points.length - 1)) * plotW;
  const toY = (val: number) => padT + plotH - ((val - minVal) / span) * plotH;

  const compoundPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.compoundWealthCny).toFixed(1)}`)
    .join(' ');
  const principalPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.principalCny).toFixed(1)}`)
    .join(' ');
  const areaPath = `${compoundPath} L ${toX(points.length - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${padL} ${(padT + plotH).toFixed(1)} Z`;

  const targetY = Math.max(padT, Math.min(padT + plotH, toY(targetWealthCny)));

  return createElement(
    'svg',
    {
      width: '100%',
      height: 172,
      viewBox: `0 0 ${width} ${height}`,
      style: { overflow: 'visible' },
    },
    createElement(
      'defs',
      null,
      createElement(
        'linearGradient',
        { id: 'wealthAreaGrad', x1: '0', y1: '0', x2: '0', y2: '1' },
        createElement('stop', { offset: '0%', stopColor: '#f5b942', stopOpacity: isDark ? '0.38' : '0.28' }),
        createElement('stop', { offset: '100%', stopColor: '#f5b942', stopOpacity: '0.0' }),
      ),
    ),
    // Horizontal Grid Lines
    [0.25, 0.5, 0.75, 1].map((ratio, idx) => {
      const val = minVal + span * ratio;
      const y = toY(val);
      return createElement(
        'g',
        { key: `grid-${idx}` },
        createElement('line', {
          x1: padL,
          y1: y,
          x2: width - padR,
          y2: y,
          stroke: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(38,36,31,0.08)',
          strokeWidth: 1,
        }),
        createElement(
          'text',
          {
            x: padL - 6,
            y: y + 3,
            textAnchor: 'end',
            fill: isDark ? '#94a3b8' : '#7a756c',
            fontSize: '9.5',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          },
          `${Math.round(val / 10000)}w`,
        ),
      );
    }),
    // Target Wealth Goal Horizontal Line
    createElement('line', {
      x1: padL,
      y1: targetY,
      x2: width - padR,
      y2: targetY,
      stroke: '#10b981',
      strokeWidth: 1.5,
      strokeDasharray: '5 4',
    }),
    createElement(
      'text',
      {
        x: width - padR - 4,
        y: Math.max(12, targetY - 5),
        textAnchor: 'end',
        fill: '#10b981',
        fontSize: '9.5',
        fontWeight: '700',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
      `🎯 ¥${(targetWealthCny / 10000).toFixed(0)}w`,
    ),
    // Area under Compound Curve
    createElement('path', {
      d: areaPath,
      fill: 'url(#wealthAreaGrad)',
    }),
    // Principal Dashed Curve
    createElement('path', {
      d: principalPath,
      fill: 'none',
      stroke: isDark ? '#64748b' : '#94a3b8',
      strokeWidth: 1.8,
      strokeDasharray: '4 4',
    }),
    // Compound Total Wealth Gold Curve
    createElement('path', {
      d: compoundPath,
      fill: 'none',
      stroke: '#f5b942',
      strokeWidth: 2.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
    // Sample Dots & X-Axis Labels
    points.map((p, idx) => {
      const cx = toX(idx);
      const cy = toY(p.compoundWealthCny);
      const showLabel = idx === 0 || idx === points.length - 1 || idx % 3 === 0;
      return createElement(
        'g',
        { key: `pt-${p.monthOffset}` },
        createElement('circle', {
          cx,
          cy,
          r: idx === points.length - 1 ? 4.2 : 2.6,
          fill: idx === points.length - 1 ? '#10b981' : '#fde68a',
          stroke: '#92400e',
          strokeWidth: 1,
        }),
        showLabel
          ? createElement(
              'text',
              {
                x: cx,
                y: height - 8,
                textAnchor: 'middle',
                fill: isDark ? '#94a3b8' : '#7a756c',
                fontSize: '9',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              },
              p.label,
            )
          : null,
      );
    }),
  );
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
  const [selectedOwner, setSelectedOwner] = useState<LedgerOwnerId>('me');
  const [amountInput, setAmountInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [smartInput, setSmartInput] = useState('');
  const [lastAddedTxId, setLastAddedTxId] = useState<string | null>(null);

  // Filters & Sub-drawers
  const [filterCat, setFilterCat] = useState<LedgerCategoryId | 'all'>('all');
  const [filterAcc, setFilterAcc] = useState<LedgerAccountId | 'all'>('all');
  const [filterOwner, setFilterOwner] = useState<LedgerOwnerId | 'all'>('all');
  const [filterDay, setFilterDay] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState(String(state.monthlyBudgetCny));

  // New interactive panels: Shortcuts Wizard, Recurring Rules Adder, Wealth Plan Editor, Partner Sync
  const [showShortcutsGuide, setShowShortcutsGuide] = useState(false);
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [newRecTitle, setNewRecTitle] = useState('');
  const [newRecAmount, setNewRecAmount] = useState('');
  const [newRecDay, setNewRecDay] = useState('1');
  const [newRecKind, setNewRecKind] = useState<LedgerEntryKind>('expense');
  const [newRecOwner, setNewRecOwner] = useState<LedgerOwnerId>('shared');

  const [editingWealthStart, setEditingWealthStart] = useState(false);
  const [wealthStartDraft, setWealthStartDraft] = useState(String(state.wealthPlan.currentSavedCny));
  const [wealthGoalDraft, setWealthGoalDraft] = useState(String(state.wealthPlan.targetWealthCny));

  const [showPartnerMergeBox, setShowPartnerMergeBox] = useState(false);
  const [partnerJsonDraft, setPartnerJsonDraft] = useState('');
  const [editingPartnerNames, setEditingPartnerNames] = useState(false);
  const [myNameDraft, setMyNameDraft] = useState(state.coupleProfile.myName);
  const [partnerNameDraft, setPartnerNameDraft] = useState(state.coupleProfile.partnerName);

  useEffect(() => {
    const unsub = subscribeBookkeepingStore(() => {
      setState(readBookkeepingState());
    });
    // 1. Auto-materialize due monthly recurring rules (salary, mortgage, subscriptions)
    ensureRecurringRulesApplied(localDay);
    // 2. Check iOS Shortcuts URL autoLog query parameter (?autoLog=... or ?amount=...&merchant=...)
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.search) {
      const parsedUrlTx = parseAutoLogUrlParams(window.location.search);
      if (parsedUrlTx) {
        addLedgerTransaction({
          ...parsedUrlTx,
          localDay,
        });
        playCashRegisterTick(parsedUrlTx.kind);
        showToast({
          text: `⚡ iOS 快捷指令已自动入账：${parsedUrlTx.note} ${parsedUrlTx.kind === 'expense' ? '-' : '+'}¥${parsedUrlTx.amountCny.toFixed(2)}`,
        });
        try {
          const cleanUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, '', cleanUrl);
        } catch {
          // Ignore history error
        }
      }
    }
    return unsub;
  }, [localDay]);

  const pal = isDark
    ? {
        bg: '#121110',
        cardBg: '#18181b',
        cardElevated: '#1f1e22',
        border: 'rgba(255, 255, 255, 0.10)',
        goldBorder: 'rgba(245, 185, 66, 0.35)',
        pinkBorder: 'rgba(244, 114, 182, 0.38)',
        ink: '#f8fafc',
        sub: '#cbd5e1',
        muted: '#94a3b8',
        gold: '#f5b942',
        goldText: '#fde68a',
        emerald: '#34d399',
        terracotta: '#f59e0b',
        pink: '#f472b6',
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
        pinkBorder: 'rgba(219, 39, 119, 0.32)',
        ink: '#26241f',
        sub: '#524e46',
        muted: '#7a756c',
        gold: '#b88228',
        goldText: '#92560c',
        emerald: '#1f5e4b',
        terracotta: '#cc785c',
        pink: '#db2777',
        danger: '#dc2626',
        pillBg: 'rgba(38, 36, 31, 0.05)',
        pillActiveBg: 'rgba(204, 120, 92, 0.15)',
        inputBg: '#f4f1ea',
      };

  const summary = useMemo(
    () => computeMonthlyBookkeepingSummary(state, localDay),
    [state, localDay],
  );
  const wealthTrajectory = useMemo(
    () =>
      computeWealthGoalTrajectory({
        wealthPlan: state.wealthPlan,
        recurringRules: state.recurringRules,
        fallbackMonthlyIncomeCny: summary.totalIncomeCny || 30000,
        currentYearMonth: summary.yearMonth,
      }),
    [state.wealthPlan, state.recurringRules, summary.totalIncomeCny, summary.yearMonth],
  );

  const ownerFilteredTransactions = useMemo(
    () =>
      filterOwner === 'all'
        ? state.transactions
        : state.transactions.filter((tx) => (tx.owner ?? 'me') === filterOwner),
    [state.transactions, filterOwner],
  );

  const categoryBreakdown = useMemo(
    () => computeCategoryBreakdown(ownerFilteredTransactions, summary.yearMonth, 'expense'),
    [ownerFilteredTransactions, summary.yearMonth],
  );
  const dailyBars = useMemo(
    () => computeDailySpendBars(ownerFilteredTransactions, localDay, 14),
    [ownerFilteredTransactions, localDay],
  );
  const accountBalances = useMemo(
    () => computeAccountBalances(ownerFilteredTransactions),
    [ownerFilteredTransactions],
  );

  const visibleCategories = useMemo(
    () => LEDGER_CATEGORIES.filter((c) => c.kind === entryKind),
    [entryKind],
  );

  // Filtered transactions grouped by localDay
  const groupedDays = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = ownerFilteredTransactions.filter((tx) => {
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
  }, [ownerFilteredTransactions, filterCat, filterAcc, filterDay, searchQuery]);

  function handleSmartNaturalSubmit() {
    const parsed = parseQuickBookkeepingInput(
      smartInput,
      selectedCategory,
      selectedAccount,
      selectedOwner,
    );
    if (!parsed) {
      showToast({
        text: t(
          '请输入包含金额的内容，例如「瑞幸咖啡 18」或「老婆买奶茶 22 微信」',
          'Include an amount, e.g. "Coffee 18" or "Wife Tea 22"',
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
    const ownerMeta = getOwnerBadgeMeta(parsed.owner, state.coupleProfile);
    showToast({
      text: t(
        `✓ 已智能入账 (${ownerMeta.icon}${ownerMeta.zh})：${cat.icon} ${parsed.note} ${parsed.kind === 'expense' ? '-' : '+'}¥${parsed.amountCny.toFixed(2)}`,
        `✓ Logged (${ownerMeta.en}): ${cat.icon} ${parsed.note} ${parsed.kind === 'expense' ? '-' : '+'}¥${parsed.amountCny.toFixed(2)}`,
      ),
    });
  }

  function handlePresetOneTap(preset: QuickLedgerPreset) {
    const owner = preset.owner ?? selectedOwner;
    const { state: next, added } = addLedgerTransaction({
      kind: 'expense',
      amountCny: preset.amountCny,
      categoryId: preset.categoryId,
      accountId: preset.accountId,
      owner,
      note: t(preset.zh, preset.en),
      localDay: filterDay ?? localDay,
    });
    setState(next);
    setLastAddedTxId(added.id);
    playCashRegisterTick('expense');
    recordPledgeReward(`闪记：${preset.zh}`, localDay, 10);
    const ownerMeta = getOwnerBadgeMeta(owner, state.coupleProfile);
    showToast({
      text: t(
        `⚡ 一键记账 (${ownerMeta.icon}${ownerMeta.zh})：${preset.icon} ${preset.zh} -¥${preset.amountCny}`,
        `⚡ 1-Tap Logged (${ownerMeta.en}): ${preset.icon} ${preset.en} -¥${preset.amountCny}`,
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
      owner: selectedOwner,
      note: cleanNote,
      localDay: filterDay ?? localDay,
    });
    setState(next);
    setLastAddedTxId(added.id);
    setAmountInput('');
    setNoteInput('');
    playCashRegisterTick(entryKind);
    recordPledgeReward(`记账：${cleanNote}`, localDay, 10);
    const ownerMeta = getOwnerBadgeMeta(selectedOwner, state.coupleProfile);
    showToast({
      text: t(
        `✓ 已记入账本 (${ownerMeta.icon}${ownerMeta.zh})：${cat.icon} ${cleanNote} ${entryKind === 'expense' ? '-' : '+'}¥${amountCny.toFixed(2)}`,
        `✓ Saved (${ownerMeta.en}): ${cat.icon} ${cleanNote} ${entryKind === 'expense' ? '-' : '+'}¥${amountCny.toFixed(2)}`,
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
        text: t(
          `✓ 本月预算已更新为 ¥${next.monthlyBudgetCny.toLocaleString('en-US')}`,
          `✓ Monthly budget set to ¥${next.monthlyBudgetCny.toLocaleString('en-US')}`,
        ),
      });
    }
    setEditingBudget(false);
  }

  function handleSaveWealthStartAndGoal() {
    const startNum = Number.parseInt(wealthStartDraft, 10);
    const goalNum = Number.parseInt(wealthGoalDraft, 10);
    const next = updateWealthPlanConfig({
      currentSavedCny: Number.isFinite(startNum) && startNum >= 0 ? startNum : state.wealthPlan.currentSavedCny,
      targetWealthCny: Number.isFinite(goalNum) && goalNum >= 50000 ? goalNum : state.wealthPlan.targetWealthCny,
    });
    setState(next);
    setEditingWealthStart(false);
    showToast({
      text: t('✓ 已更新起始净资产与财富目标，复利曲线已重算', '✓ Updated starting net worth & goal target'),
    });
  }

  function handleAddNewRecurringRule() {
    const amt = evaluateAmountExpression(newRecAmount);
    if (!amt || amt <= 0) {
      showToast({ text: t('请输入周期账单金额', 'Enter recurring amount'), tone: 'error' });
      return;
    }
    const dayNum = Math.max(1, Math.min(28, Number.parseInt(newRecDay, 10) || 1));
    const title =
      newRecTitle.trim() ||
      (newRecKind === 'income' ? t('固定薪资/副业收入', 'Monthly Income') : t('固定房租/订阅扣款', 'Monthly Bill'));
    const next = addRecurringLedgerRule({
      title,
      kind: newRecKind,
      amountCny: amt,
      categoryId: newRecKind === 'income' ? 'salary' : 'housing',
      accountId: 'bank',
      dayOfMonth: dayNum,
      owner: newRecOwner,
    });
    setState(next);
    setNewRecTitle('');
    setNewRecAmount('');
    setShowAddRecurring(false);
    showToast({
      text: t(
        `✓ 已新增周期自动入账规则：每月 ${dayNum} 日「${title}」`,
        `✓ Added recurring rule on day ${dayNum}: "${title}"`,
      ),
    });
  }

  async function handleCopyPartnerSyncCode() {
    const json = JSON.stringify(state, null, 2);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(json);
      showToast({
        text: t(
          `💌 已复制双人家庭账本同步码！发微信给${state.coupleProfile.partnerName}粘贴即可无损合并双方账单`,
          '💌 Copied Couple Co-Op sync JSON! Send to your partner to merge.',
        ),
      });
      return;
    }
    try {
      await Share.share({ title: 'couple-ledger-sync.json', message: json });
    } catch {
      showToast({ text: t('复制失败', 'Copy failed'), tone: 'error' });
    }
  }

  function handleMergePartnerJson() {
    try {
      const { state: merged, addedTxCount } = importPartnerBookkeepingJson(partnerJsonDraft);
      setState(merged);
      setShowPartnerMergeBox(false);
      setPartnerJsonDraft('');
      playCashRegisterTick('income');
      showToast({
        text: t(
          `👩‍❤️‍👨 双人账本合并成功！新增同步了 ${addedTxCount} 笔来自${merged.coupleProfile.partnerName}的账单`,
          `👩‍❤️‍👨 Merged ${addedTxCount} new transactions from partner!`,
        ),
      });
    } catch {
      showToast({
        text: t('同步码格式不正确，请粘贴完整的账本 JSON', 'Invalid partner sync JSON'),
        tone: 'error',
      });
    }
  }

  async function handleCopyShortcutUrlTemplate() {
    const baseUrl =
      Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
        ? `${window.location.origin}/ledger?autoLog=`
        : 'http://localhost:8081/ledger?autoLog=';
    const template = `${baseUrl}瑞幸拿铁+18+微信`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(template);
      showToast({
        text: t(
          '✓ 已复制 iOS 快捷指令唤起 URL 模板到剪贴板！',
          '✓ Copied iOS Shortcuts auto-log URL template!',
        ),
      });
    }
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
      {/* 0. Couple Co-Op Team Bar (👩‍❤️‍👨 我 & 老婆 双人组队共创栏 + iOS 快捷指令自动记账入口) */}
      <View
        style={[
          styles.coupleBanner,
          { backgroundColor: isDark ? '#1c161c' : '#fdf2f8', borderBottomColor: pal.pinkBorder },
        ]}
      >
        <View style={styles.coupleLeftCluster}>
          <View style={[styles.coupleAvatarPill, { backgroundColor: `${pal.pink}22`, borderColor: pal.pink }]}>
            <Text variant="caption" style={{ color: pal.ink, fontWeight: '700', fontSize: 11.5 }}>
              {`👩‍❤️‍👨 ${state.coupleProfile.myName} & ${state.coupleProfile.partnerName} · ${t('双人组队共管', 'Couple Co-Op')}`}
            </Text>
          </View>
          {editingPartnerNames ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <TextInput
                value={myNameDraft}
                onChangeText={setMyNameDraft}
                placeholder="我"
                style={[styles.miniNameInput, { backgroundColor: pal.inputBg, borderColor: pal.border, color: pal.ink }]}
              />
              <Text variant="caption" style={{ color: pal.muted }}>&amp;</Text>
              <TextInput
                value={partnerNameDraft}
                onChangeText={setPartnerNameDraft}
                placeholder="老婆"
                style={[styles.miniNameInput, { backgroundColor: pal.inputBg, borderColor: pal.pink, color: pal.ink }]}
              />
              <Pressable
                onPress={() => {
                  const next = updateCoupleTeamProfile({
                    myName: myNameDraft.trim() || '我',
                    partnerName: partnerNameDraft.trim() || '老婆',
                  });
                  setState(next);
                  setEditingPartnerNames(false);
                }}
                style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
              >
                <Text variant="caption" style={{ color: pal.goldText, fontSize: 10, fontWeight: '700' }}>✓</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setMyNameDraft(state.coupleProfile.myName);
                setPartnerNameDraft(state.coupleProfile.partnerName);
                setEditingPartnerNames(true);
              }}
            >
              <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5 }}>
                {t(
                  `🔥 组队连击 ${state.coupleProfile.teamStreakDays} 天 · 👨${state.coupleProfile.myName}支 ¥${summary.byOwner.meExpenseCny.toFixed(0)} · 👩${state.coupleProfile.partnerName}支 ¥${summary.byOwner.partnerExpenseCny.toFixed(0)} · 👩‍❤️‍👨共同 ¥${summary.byOwner.sharedExpenseCny.toFixed(0)} ✎`,
                  `🔥 ${state.coupleProfile.teamStreakDays}d streak · Me ¥${summary.byOwner.meExpenseCny.toFixed(0)} · Partner ¥${summary.byOwner.partnerExpenseCny.toFixed(0)} · Joint ¥${summary.byOwner.sharedExpenseCny.toFixed(0)} ✎`,
                )}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.coupleRightActions}>
          {/* Owner View Filter Pills */}
          {(
            [
              { id: 'all', label: t('全部', 'All') },
              { id: 'me', label: `👨 ${state.coupleProfile.myName}` },
              { id: 'partner', label: `👩 ${state.coupleProfile.partnerName}` },
              { id: 'shared', label: t('👩‍❤️‍👨 共同', '👩‍❤️‍👨 Joint') },
            ] as const
          ).map((item) => {
            const active = filterOwner === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setFilterOwner(item.id)}
                style={[
                  styles.microBtn,
                  {
                    backgroundColor: active ? `${pal.pink}26` : pal.pillBg,
                    borderColor: active ? pal.pink : pal.border,
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
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="复制双人账本同步码发给老婆"
            onPress={() => void handleCopyPartnerSyncCode()}
            style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
          >
            <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
              {t(`💌 发给${state.coupleProfile.partnerName}`, '💌 Share Sync')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="合并老婆发来的账本同步码"
            onPress={() => setShowPartnerMergeBox((prev) => !prev)}
            style={[styles.microBtn, { backgroundColor: pal.pillBg, borderColor: pal.pink }]}
          >
            <Text variant="caption" style={{ color: pal.pink, fontSize: 10.5, fontWeight: '700' }}>
              {t(`📥 合并${state.coupleProfile.partnerName}账单`, '📥 Merge Partner')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="打开 iOS 快捷指令自动记账配置向导"
            onPress={() => setShowShortcutsGuide((prev) => !prev)}
            style={[styles.microBtn, { backgroundColor: pal.pillBg, borderColor: pal.emerald }]}
          >
            <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, fontWeight: '700' }}>
              {t('📱 iOS自动记账', '📱 iOS Auto-Log')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Optional Drawer A: Partner Sync Merge Box */}
      {showPartnerMergeBox ? (
        <View style={[styles.drawerPanel, { backgroundColor: pal.cardElevated, borderBottomColor: pal.border }]}>
          <Text variant="caption" style={{ color: pal.ink, fontWeight: '700', fontSize: 11.5 }}>
            {t(
              `👩‍❤️‍👨 粘贴${state.coupleProfile.partnerName}发来的同步码（会自动按账单 ID 无损合并，绝不覆盖你已有的记录）：`,
              '👩‍❤️‍👨 Paste your partner’s sync JSON below to non-destructively merge transactions:',
            )}
          </Text>
          <TextInput
            value={partnerJsonDraft}
            onChangeText={setPartnerJsonDraft}
            placeholder='{"transactions": [...]}'
            placeholderTextColor={pal.muted}
            multiline
            style={[
              styles.mergeTextarea,
              { backgroundColor: pal.inputBg, borderColor: pal.pink, color: pal.ink },
            ]}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Pressable
              onPress={() => setShowPartnerMergeBox(false)}
              style={[styles.microBtn, { backgroundColor: pal.pillBg, borderColor: pal.border }]}
            >
              <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5 }}>{t('取消', 'Cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={handleMergePartnerJson}
              style={[styles.microBtn, { backgroundColor: `${pal.pink}28`, borderColor: pal.pink }]}
            >
              <Text variant="caption" style={{ color: pal.ink, fontSize: 10.5, fontWeight: '700' }}>
                {t('✓ 立即无损合并双人账单', '✓ Merge Partner Ledger')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Optional Drawer B: iOS Shortcuts Automatic Bookkeeping Wizard */}
      {showShortcutsGuide ? (
        <View style={[styles.drawerPanel, { backgroundColor: pal.cardElevated, borderBottomColor: pal.border }]}>
          <View style={styles.sectionTitleRow}>
            <Text variant="label" style={{ color: pal.goldText, fontWeight: '700', fontSize: 12.5 }}>
              {t('📱 iOS「快捷指令 + 轻点背面两下」全自动记账配置（1 分钟配好）', '📱 iOS Shortcuts Back-Tap Auto-Bookkeeping Setup')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable
                onPress={() => void handleCopyShortcutUrlTemplate()}
                style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
              >
                <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                  {t('📋 复制唤起 URL 模板', '📋 Copy Shortcut URL')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const sample = parseAutoLogUrlParams('?autoLog=瑞幸生椰拿铁+18+微信');
                  if (sample) {
                    const { state: next, added } = addLedgerTransaction({ ...sample, localDay });
                    setState(next);
                    setLastAddedTxId(added.id);
                    playCashRegisterTick('expense');
                    showToast({ text: t('⚡ 已模拟 iOS 快捷指令自动入账：瑞幸生椰拿铁 -¥18', '⚡ Simulated iOS Shortcut Auto-Log: -¥18') });
                  }
                }}
                style={[styles.microBtn, { backgroundColor: `${pal.emerald}24`, borderColor: pal.emerald }]}
              >
                <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, fontWeight: '700' }}>
                  {t('⚡ 测试自动入账效果', '⚡ Test Auto-Log')}
                </Text>
              </Pressable>
            </View>
          </View>
          <Text variant="caption" style={{ color: pal.sub, fontSize: 11, lineHeight: 17 }}>
            {t(
              '① 打开 iPhone「快捷指令」App → 新建指令，添加动作「截屏」→「从图像中提取文本」；\n② 添加动作「打开 URL」，填入 `/ledger?autoLog=[提取的文本]`；\n③ 在 iPhone「设置 → 辅助功能 → 触控 → 轻点背面 → 轻点两下」勾选该快捷指令。以后微信/支付宝付完款，手指敲两下手机背面即可自动识别金额与商户并秒记入账！',
              '1. In iOS Shortcuts, add "Take Screenshot" -> "Extract Text from Image"; 2. Add "Open URLs" with `/ledger?autoLog=[Extracted Text]`; 3. Bind to Settings -> Accessibility -> Touch -> Back Tap (Double Tap).',
            )}
          </Text>
        </View>
      ) : null}

      {/* 1. Top Monthly Budget & Safe-to-Spend Cockpit Header */}
      <View style={[styles.topCockpit, { backgroundColor: pal.cardElevated, borderBottomColor: pal.border }]}>
        <View style={styles.topMetricsRow}>
          {/* Metric 1: Monthly Expense & Budget Progress */}
          <View style={[styles.metricCard, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
            <View style={styles.metricHeaderRow}>
              <Text variant="caption" style={{ color: pal.muted, fontSize: 11 }}>
                {t(`${summary.yearMonth} 家庭本月支出`, `${summary.yearMonth} Monthly Spend`)}
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
                {t('双人本月总收入与净结余', 'Combined Income & Net Savings')}
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
                `本月净结余 ${summary.netCashflowCny >= 0 ? '+' : ''}¥${summary.netCashflowCny.toLocaleString('en-US')}（👨¥${summary.byOwner.meIncomeCny.toLocaleString('en-US')} + 👩¥${summary.byOwner.partnerIncomeCny.toLocaleString('en-US')}）`,
                `Net ${summary.netCashflowCny >= 0 ? '+' : ''}¥${summary.netCashflowCny.toLocaleString('en-US')}`,
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
                '⚡ 一句话秒记（如：瑞幸拿铁 18 微信 / 老婆买奶茶 22 / 双人盒马买菜 128 支付宝）…',
                '⚡ Smart Log (e.g. Latte 18 WeChat / Wife Tea 22 / Couple Groceries 128)…',
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

      {/* 1.5. Interactive Salary × Investment Ratio -> Target Wealth Trajectory Curve Card */}
      {!compact ? (
        <View style={[styles.wealthCardWrap, { backgroundColor: pal.cardBg, borderColor: pal.goldBorder }]}>
          <View style={styles.sectionTitleRow}>
            <View style={{ gap: 2 }}>
              <Text variant="label" style={{ color: pal.goldText, fontSize: 14, fontWeight: '700' }}>
                {t(
                  '📈 薪资 × 定投比例 → 目标财富达成曲线（双人合力复利模拟）',
                  '📈 Salary × Invest Ratio → Target Wealth Compound Trajectory',
                )}
              </Text>
              <Text variant="caption" style={{ color: pal.ink, fontSize: 12, fontWeight: '600' }}>
                {wealthTrajectory.alreadyReached
                  ? t(
                      `🎉 当前净资产 ¥${wealthTrajectory.currentSavedCny.toLocaleString('en-US')} 已达成 ¥${wealthTrajectory.targetWealthCny.toLocaleString('en-US')} 目标！可点右侧切换更高目标`,
                      `🎉 Already reached ¥${wealthTrajectory.targetWealthCny.toLocaleString('en-US')}! Select a higher target.`,
                    )
                  : t(
                      `按双人月入 ¥${wealthTrajectory.monthlyIncomeCny.toLocaleString('en-US')} × 定投 ${wealthTrajectory.investRatePct}%（每月攒 ¥${wealthTrajectory.monthlyInvestCny.toLocaleString('en-US')} · 年化 ${wealthTrajectory.annualReturnPct}%），预计 ${wealthTrajectory.yearsPart > 0 ? `${wealthTrajectory.yearsPart} 年 ` : ''}${wealthTrajectory.monthsPart} 个月（${wealthTrajectory.estimatedGoalYearMonth}）达成 ¥${(wealthTrajectory.targetWealthCny / 10000).toFixed(0)} 万目标！`,
                      `Investing ${wealthTrajectory.investRatePct}% (¥${wealthTrajectory.monthlyInvestCny.toLocaleString('en-US')}/mo @ ${wealthTrajectory.annualReturnPct}% APY) reaches ¥${(wealthTrajectory.targetWealthCny / 10000).toFixed(0)}w in ${wealthTrajectory.yearsPart}y ${wealthTrajectory.monthsPart}m (${wealthTrajectory.estimatedGoalYearMonth})!`,
                    )}
              </Text>
            </View>

            {/* Quick Edit Starting Net Worth & Goal */}
            {editingWealthStart ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text variant="caption" style={{ color: pal.muted, fontSize: 10 }}>{t('当前存款:', 'Saved:')}</Text>
                <TextInput
                  value={wealthStartDraft}
                  onChangeText={setWealthStartDraft}
                  style={[styles.miniNameInput, { width: 78, backgroundColor: pal.inputBg, borderColor: pal.gold, color: pal.ink }]}
                />
                <Text variant="caption" style={{ color: pal.muted, fontSize: 10 }}>{t('目标:', 'Goal:')}</Text>
                <TextInput
                  value={wealthGoalDraft}
                  onChangeText={setWealthGoalDraft}
                  onSubmitEditing={handleSaveWealthStartAndGoal}
                  style={[styles.miniNameInput, { width: 82, backgroundColor: pal.inputBg, borderColor: pal.emerald, color: pal.ink }]}
                />
                <Pressable
                  onPress={handleSaveWealthStartAndGoal}
                  style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
                >
                  <Text variant="caption" style={{ color: pal.goldText, fontSize: 10, fontWeight: '700' }}>✓</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  setWealthStartDraft(String(state.wealthPlan.currentSavedCny));
                  setWealthGoalDraft(String(state.wealthPlan.targetWealthCny));
                  setEditingWealthStart(true);
                }}
                style={[styles.microBtn, { backgroundColor: pal.pillBg, borderColor: pal.border }]}
              >
                <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                  {t(
                    `当前已攒 ¥${(wealthTrajectory.currentSavedCny / 10000).toFixed(1)}w · 目标 ¥${(wealthTrajectory.targetWealthCny / 10000).toFixed(0)}w ✎`,
                    `Saved ¥${(wealthTrajectory.currentSavedCny / 10000).toFixed(1)}w · Goal ¥${(wealthTrajectory.targetWealthCny / 10000).toFixed(0)}w ✎`,
                  )}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Interactive Sliders / Pill Controls for Invest Ratio, Annual Return & Target Goal */}
          <View style={styles.wealthControlsBar}>
            <View style={styles.wealthControlGroup}>
              <Text variant="caption" style={{ color: pal.muted, fontSize: 10.5 }}>
                {t('定投比例：', 'Invest Ratio:')}
              </Text>
              {[25, 35, 45, 55, 65, 75].map((pct) => {
                const active = state.wealthPlan.investRatePct === pct;
                return (
                  <Pressable
                    key={`ir-${pct}`}
                    onPress={() => setState(updateWealthPlanConfig({ investRatePct: pct }))}
                    style={[
                      styles.microBtn,
                      {
                        backgroundColor: active ? pal.pillActiveBg : pal.pillBg,
                        borderColor: active ? pal.gold : pal.border,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={{
                        fontSize: 10,
                        fontWeight: active ? '700' : '500',
                        color: active ? pal.goldText : pal.sub,
                      }}
                    >
                      {`${pct}%`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.wealthControlGroup}>
              <Text variant="caption" style={{ color: pal.muted, fontSize: 10.5 }}>
                {t('预期年化：', 'Return APY:')}
              </Text>
              {[
                { rate: 4, label: t('4% 稳健债基', '4% Bond') },
                { rate: 8, label: t('8% 宽基定投', '8% Index') },
                { rate: 12, label: t('12% 进取成长', '12% Growth') },
              ].map((item) => {
                const active = state.wealthPlan.annualReturnPct === item.rate;
                return (
                  <Pressable
                    key={`apy-${item.rate}`}
                    onPress={() => setState(updateWealthPlanConfig({ annualReturnPct: item.rate }))}
                    style={[
                      styles.microBtn,
                      {
                        backgroundColor: active ? `${pal.emerald}24` : pal.pillBg,
                        borderColor: active ? pal.emerald : pal.border,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={{
                        fontSize: 10,
                        fontWeight: active ? '700' : '500',
                        color: active ? pal.emerald : pal.sub,
                      }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.wealthControlGroup}>
              <Text variant="caption" style={{ color: pal.muted, fontSize: 10.5 }}>
                {t('阶段目标：', 'Target:')}
              </Text>
              {[1000000, 1500000, 3000000, 5000000].map((goal) => {
                const active = state.wealthPlan.targetWealthCny === goal;
                return (
                  <Pressable
                    key={`goal-${goal}`}
                    onPress={() => setState(updateWealthPlanConfig({ targetWealthCny: goal }))}
                    style={[
                      styles.microBtn,
                      {
                        backgroundColor: active ? pal.pillActiveBg : pal.pillBg,
                        borderColor: active ? pal.gold : pal.border,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      style={{
                        fontSize: 10,
                        fontWeight: active ? '700' : '500',
                        color: active ? pal.goldText : pal.sub,
                      }}
                    >
                      {`¥${goal / 10000}w`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* SVG Compound Wealth Curve */}
          <WealthTrajectorySvg
            points={wealthTrajectory.points}
            targetWealthCny={wealthTrajectory.targetWealthCny}
            isDark={isDark}
          />

          {/* 4 Horizon Milestone Cards (1Y / 3Y / 5Y / 10Y) */}
          <View style={styles.milestoneHorizonsRow}>
            {wealthTrajectory.milestones.map((ms) => (
              <View
                key={ms.horizonLabel}
                style={[styles.horizonCard, { backgroundColor: pal.cardElevated, borderColor: pal.border }]}
              >
                <Text variant="caption" style={{ color: pal.muted, fontSize: 10 }}>
                  {ms.horizonLabel}
                </Text>
                <Text
                  variant="label"
                  style={{
                    color: pal.goldText,
                    fontFamily: theme.fontFamily.mono,
                    fontSize: 13,
                    fontWeight: '700',
                  }}
                >
                  {`¥${(ms.compoundWealthCny / 10000).toFixed(1)}w`}
                </Text>
                <Text variant="caption" style={{ color: pal.emerald, fontSize: 9.5 }}>
                  {t(
                    `本金 ${(ms.principalCny / 10000).toFixed(1)}w + 复利 ${(ms.gainCny / 10000).toFixed(1)}w`,
                    `Prin ${(ms.principalCny / 10000).toFixed(1)}w + Gain ${(ms.gainCny / 10000).toFixed(1)}w`,
                  )}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* 2. Main Split Workspace: Left Interactive Category Keypad & Right Analytics/Stream */}
      {!compact ? (
        <View style={styles.mainSplitGrid}>
          {/* Left Column: Visual Category Grid + Built-in Calculator Keypad + Recurring Rules */}
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

            {/* Member Attribution Selector (👨 我 | 👩 老婆 | 👩‍❤️‍👨 共同) */}
            <View style={styles.accountSelectorRow}>
              {(
                [
                  { id: 'me', icon: '👨', label: state.coupleProfile.myName, color: '#38bdf8' },
                  { id: 'partner', icon: '👩', label: state.coupleProfile.partnerName, color: '#f472b6' },
                  { id: 'shared', icon: '👩‍❤️‍👨', label: t('共同开销', 'Joint'), color: '#f5b942' },
                ] as const
              ).map((ow) => {
                const active = selectedOwner === ow.id;
                return (
                  <Pressable
                    key={ow.id}
                    onPress={() => setSelectedOwner(ow.id)}
                    style={[
                      styles.accountChip,
                      {
                        backgroundColor: active ? `${ow.color}22` : pal.pillBg,
                        borderColor: active ? ow.color : pal.border,
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
                      {`${ow.icon} ${ow.label}`}
                    </Text>
                  </Pressable>
                );
              })}
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

            {/* Recurring Rules Section (🔁 周期性自动入账规则) */}
            <View style={styles.walletSection}>
              <View style={styles.metricHeaderRow}>
                <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontWeight: '700' }}>
                  {t('🔁 周期性固定收支自动入账（月薪/房贷/订阅）', '🔁 Auto-Recurring Monthly Rules')}
                </Text>
                <Pressable
                  onPress={() => setShowAddRecurring((prev) => !prev)}
                  style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
                >
                  <Text variant="caption" style={{ color: pal.goldText, fontSize: 10, fontWeight: '700' }}>
                    {showAddRecurring ? t('收起', 'Close') : t('＋ 新增规则', '＋ Add Rule')}
                  </Text>
                </Pressable>
              </View>

              {showAddRecurring ? (
                <View style={[styles.dayGroupCard, { padding: 8, gap: 6, backgroundColor: pal.cardElevated, borderColor: pal.gold }]}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable
                      onPress={() => setNewRecKind((prev) => (prev === 'expense' ? 'income' : 'expense'))}
                      style={[styles.microBtn, { backgroundColor: pal.pillBg, borderColor: pal.border }]}
                    >
                      <Text variant="caption" style={{ color: newRecKind === 'income' ? pal.emerald : pal.terracotta, fontSize: 10, fontWeight: '700' }}>
                        {newRecKind === 'income' ? t('💰 固定收入', '💰 Income') : t('🏠 固定支出', '🏠 Expense')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        setNewRecOwner((prev) => (prev === 'me' ? 'partner' : prev === 'partner' ? 'shared' : 'me'))
                      }
                      style={[styles.microBtn, { backgroundColor: pal.pillBg, borderColor: pal.border }]}
                    >
                      <Text variant="caption" style={{ color: pal.ink, fontSize: 10 }}>
                        {getOwnerBadgeMeta(newRecOwner, state.coupleProfile).icon}{' '}
                        {getOwnerBadgeMeta(newRecOwner, state.coupleProfile).zh}
                      </Text>
                    </Pressable>
                    <TextInput
                      value={newRecDay}
                      onChangeText={setNewRecDay}
                      placeholder="1"
                      style={[styles.miniNameInput, { width: 42, backgroundColor: pal.inputBg, borderColor: pal.border, color: pal.ink }]}
                    />
                    <Text variant="caption" style={{ color: pal.muted, fontSize: 10, alignSelf: 'center' }}>
                      {t('日自动入账', 'day/mo')}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TextInput
                      value={newRecTitle}
                      onChangeText={setNewRecTitle}
                      placeholder={t('规则名称 (如: 车贷 / 宽带)…', 'Rule title…')}
                      placeholderTextColor={pal.muted}
                      style={[styles.noteField, { height: 28, fontSize: 11, backgroundColor: pal.inputBg, borderColor: pal.border, color: pal.ink }]}
                    />
                    <TextInput
                      value={newRecAmount}
                      onChangeText={setNewRecAmount}
                      placeholder="¥金额"
                      placeholderTextColor={pal.muted}
                      style={[styles.miniNameInput, { width: 68, backgroundColor: pal.inputBg, borderColor: pal.border, color: pal.ink }]}
                    />
                    <Pressable
                      onPress={handleAddNewRecurringRule}
                      style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold, justifyContent: 'center' }]}
                    >
                      <Text variant="caption" style={{ color: pal.goldText, fontSize: 10, fontWeight: '700' }}>
                        {t('保存', 'Save')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View style={{ gap: 5 }}>
                {state.recurringRules.map((rule) => {
                  const ownerMeta = getOwnerBadgeMeta(rule.owner, state.coupleProfile);
                  return (
                    <View
                      key={rule.id}
                      style={[
                        styles.recurringRow,
                        {
                          backgroundColor: pal.cardElevated,
                          borderColor: rule.enabled ? pal.border : 'transparent',
                          opacity: rule.enabled ? 1 : 0.55,
                        },
                      ]}
                    >
                      <Pressable
                        onPress={() => setState(toggleRecurringLedgerRule(rule.id))}
                        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                      >
                        <Text variant="caption" style={{ color: rule.enabled ? pal.emerald : pal.muted, fontSize: 11 }}>
                          {rule.enabled ? '●' : '○'}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text variant="caption" style={{ color: pal.ink, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                            {rule.title}
                          </Text>
                          <Text variant="caption" style={{ color: pal.muted, fontSize: 9.5 }}>
                            {`${t(`每月 ${rule.dayOfMonth} 日`, `Day ${rule.dayOfMonth}`)} · ${ownerMeta.icon}${ownerMeta.zh}`}
                          </Text>
                        </View>
                      </Pressable>
                      <Text
                        variant="caption"
                        style={{
                          fontFamily: theme.fontFamily.mono,
                          fontSize: 11,
                          fontWeight: '700',
                          color: rule.kind === 'income' ? pal.emerald : pal.ink,
                        }}
                      >
                        {`${rule.kind === 'income' ? '+' : '-'}¥${rule.amountCny.toLocaleString('en-US')}`}
                      </Text>
                      <Pressable
                        onPress={() => setState(removeRecurringLedgerRule(rule.id))}
                        style={[styles.deleteTxBtn, { backgroundColor: pal.pillBg }]}
                      >
                        <Text variant="caption" style={{ color: pal.muted, fontSize: 10 }}>×</Text>
                      </Pressable>
                    </View>
                  );
                })}
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
                {filterCat !== 'all' || filterAcc !== 'all' || filterOwner !== 'all' || filterDay ? (
                  <Pressable
                    onPress={() => {
                      setFilterCat('all');
                      setFilterAcc('all');
                      setFilterOwner('all');
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
                  {t('🧾 双人收支流水明细', '🧾 Couple Transaction Ledger')}
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
                        const ownerMeta = getOwnerBadgeMeta(tx.owner, state.coupleProfile);
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
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                  <Text variant="caption" style={{ color: pal.ink, fontSize: 12, fontWeight: '600' }}>
                                    {tx.note}
                                  </Text>
                                  <View
                                    style={[
                                      styles.ownerMiniTag,
                                      { backgroundColor: `${ownerMeta.color}20`, borderColor: `${ownerMeta.color}66` },
                                    ]}
                                  >
                                    <Text variant="caption" style={{ color: ownerMeta.color, fontSize: 9, fontWeight: '700' }}>
                                      {`${ownerMeta.icon}${ownerMeta.zh}`}
                                    </Text>
                                  </View>
                                </View>
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
  coupleBanner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  coupleLeftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  coupleAvatarPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  coupleRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  miniNameInput: {
    width: 60,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 5,
    borderWidth: 1,
    fontSize: 10.5,
  },
  drawerPanel: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    gap: 8,
  },
  mergeTextarea: {
    minHeight: 68,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    fontFamily: theme.fontFamily.mono,
    fontSize: 11,
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
  wealthCardWrap: {
    marginHorizontal: 14,
    marginTop: 12,
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  wealthControlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  wealthControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  milestoneHorizonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  horizonCard: {
    flex: 1,
    minWidth: 130,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
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
    minWidth: 88,
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
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
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
  ownerMiniTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
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
