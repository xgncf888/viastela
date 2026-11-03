import { createElement, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';

import {
  type BookkeepingState,
  computeAccountBalances,
  computeCategoryBreakdown,
  computeDailySpendBars,
  computeMonthlyBookkeepingSummary,
  computeMultiLedgerPoolBreakdown,
  computeWealthGoalTrajectory,
  type CoupleChatMessage,
  DEFAULT_COUPLE_CHAT_MESSAGES,
  DEFAULT_LEDGER_BOOKS,
  evaluateAmountExpression,
  filterTransactionsByLedgerScope,
  formatLedgerCsv,
  getLedgerAccountMeta,
  getLedgerBookMeta,
  getLedgerCategoryMeta,
  getOwnerBadgeMeta,
  LEDGER_ACCOUNTS,
  LEDGER_CATEGORIES,
  type LedgerAccountId,
  type LedgerBookId,
  type LedgerCategoryId,
  type LedgerEntryKind,
  type LedgerOwnerId,
  type LedgerScopeId,
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
  bindCoupleFriendAndRoom,
  clearDemoBookkeepingData,
  connectCoupleRealtimeRoom,
  ensureRecurringRulesApplied,
  getCoupleSyncStatus,
  importPartnerBookkeepingJson,
  readBookkeepingState,
  removeLedgerBook,
  removeLedgerTransaction,
  removeQuickLedgerPreset,
  removeRecurringLedgerRule,
  saveCoupleCloudRelayConfig,
  saveLedgerBook,
  saveQuickLedgerPreset,
  sendCoupleChatMessage,
  simulatePartnerLiveSyncEvent,
  subscribeBookkeepingStore,
  toggleLedgerBookPoolInclusion,
  toggleRecurringLedgerRule,
  updateAccountInitialBalance,
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

let sliderCssInjected = false;
function ensureRangeSliderCss() {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || sliderCssInjected) return;
  sliderCssInjected = true;
  try {
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-vs-slider', 'true');
    styleEl.textContent = `
      input.vs-range-slider {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 24px;
        background: transparent;
        outline: none;
        margin: 0;
        cursor: grab;
      }
      input.vs-range-slider:active {
        cursor: grabbing;
      }
      input.vs-range-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #fde68a;
        border: 2px solid #b45309;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
        cursor: grab;
        transition: transform 120ms ease;
      }
      input.vs-range-slider::-webkit-slider-thumb:hover {
        transform: scale(1.15);
      }
      input.vs-range-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #fde68a;
        border: 2px solid #b45309;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
        cursor: grab;
      }
    `;
    document.head.appendChild(styleEl);
  } catch {
    // Ignore SSR/test environment
  }
}

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
 * High-Precision Continuous Draggable Range Slider with Visual Progress Fill & Fine Steppers.
 */
function InteractiveRangeSlider({
  label,
  valueText,
  subText,
  value,
  min,
  max,
  step,
  accentColor,
  trackBg,
  borderColor,
  inkColor,
  mutedColor,
  onChange,
}: {
  label: string;
  valueText: string;
  subText?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  accentColor: string;
  trackBg: string;
  borderColor: string;
  inkColor: string;
  mutedColor: string;
  onChange: (nextVal: number) => void;
}) {
  const clamped = Math.max(min, Math.min(max, value));
  const pct = Math.max(0, Math.min(100, ((clamped - min) / Math.max(1e-6, max - min)) * 100));

  const nudge = (delta: number) => {
    const next = Math.max(min, Math.min(max, Math.round((clamped + delta) * 100) / 100));
    onChange(next);
  };

  return (
    <View style={[styles.sliderCard, { borderColor }]}>
      <View style={styles.sliderTopRow}>
        <Text variant="caption" style={{ color: mutedColor, fontSize: 11, fontWeight: '600' }}>
          {label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          {subText ? (
            <Text variant="caption" style={{ color: mutedColor, fontSize: 10 }}>
              {subText}
            </Text>
          ) : null}
          <Text
            variant="label"
            style={{
              color: inkColor,
              fontFamily: theme.fontFamily.mono,
              fontSize: 13,
              fontWeight: '700',
            }}
          >
            {valueText}
          </Text>
        </View>
      </View>

      <View style={styles.sliderControlRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`减小 ${label}`}
          onPress={() => nudge(-step)}
          style={[styles.sliderStepBtn, { borderColor, backgroundColor: trackBg }]}
        >
          <Text variant="caption" style={{ color: mutedColor, fontSize: 11, fontWeight: '700' }}>
            −
          </Text>
        </Pressable>

        <View style={styles.sliderTrackContainer}>
          <View style={[styles.sliderVisualTrack, { backgroundColor: trackBg }]}>
            <View
              style={[
                styles.sliderVisualFill,
                { width: `${pct}%`, backgroundColor: accentColor },
              ]}
            />
          </View>
          {Platform.OS === 'web'
            ? createElement('input', {
                type: 'range',
                className: 'vs-range-slider',
                min: String(min),
                max: String(max),
                step: String(step),
                value: String(clamped),
                'aria-label': label,
                onChange: (e: { target: { value: string } }) => {
                  const num = Number.parseFloat(e.target.value);
                  if (Number.isFinite(num)) onChange(num);
                },
                style: {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: '100%',
                  height: 24,
                },
              })
            : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`增加 ${label}`}
          onPress={() => nudge(step)}
          style={[styles.sliderStepBtn, { borderColor, backgroundColor: trackBg }]}
        >
          <Text variant="caption" style={{ color: mutedColor, fontSize: 11, fontWeight: '700' }}>
            ＋
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Interactive SVG Compound Wealth Trajectory Chart with Active Point Crosshair Scrubber
 */
function WealthTrajectorySvg({
  points,
  targetWealthCny,
  activePointIdx,
  onSelectPointIdx,
  isDark,
}: {
  points: readonly {
    monthOffset: number;
    yearMonth: string;
    label: string;
    principalCny: number;
    compoundWealthCny: number;
    gainCny: number;
  }[];
  targetWealthCny: number;
  activePointIdx: number;
  onSelectPointIdx: (idx: number) => void;
  isDark: boolean;
}) {
  if (Platform.OS !== 'web' || points.length < 2) {
    return null;
  }

  const width = 620;
  const height = 176;
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
  const clampedActiveIdx = Math.max(0, Math.min(points.length - 1, activePointIdx));
  const activeX = toX(clampedActiveIdx);
  const activePt = points[clampedActiveIdx]!;
  const activeY = toY(activePt.compoundWealthCny);

  return createElement(
    'svg',
    {
      width: '100%',
      height: 176,
      viewBox: `0 0 ${width} ${height}`,
      style: { overflow: 'visible', cursor: 'ew-resize' },
    },
    createElement(
      'defs',
      null,
      createElement(
        'linearGradient',
        { id: 'wealthAreaGrad', x1: '0', y1: '0', x2: '0', y2: '1' },
        createElement('stop', { offset: '0%', stopColor: '#f5b942', stopOpacity: isDark ? '0.35' : '0.24' }),
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
      strokeWidth: 1.4,
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
      `TARGET ¥${(targetWealthCny / 10000).toFixed(0)}w`,
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
      strokeWidth: 1.6,
      strokeDasharray: '4 4',
    }),
    // Compound Total Wealth Gold Curve
    createElement('path', {
      d: compoundPath,
      fill: 'none',
      stroke: '#f5b942',
      strokeWidth: 2.5,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
    // Active Scrubber Vertical Crosshair Line
    createElement('line', {
      x1: activeX,
      y1: padT,
      x2: activeX,
      y2: padT + plotH,
      stroke: isDark ? 'rgba(253, 230, 138, 0.45)' : 'rgba(184, 130, 40, 0.45)',
      strokeWidth: 1.2,
      strokeDasharray: '3 3',
    }),
    // Sample Dots & Interactive Hit Columns
    points.map((p, idx) => {
      const cx = toX(idx);
      const cy = toY(p.compoundWealthCny);
      const isSelected = idx === clampedActiveIdx;
      const showLabel = idx === 0 || idx === points.length - 1 || idx % 3 === 0;
      return createElement(
        'g',
        {
          key: `pt-${p.monthOffset}`,
          onMouseEnter: () => onSelectPointIdx(idx),
          onClick: () => onSelectPointIdx(idx),
        },
        createElement('rect', {
          x: cx - plotW / (points.length * 2),
          y: padT,
          width: plotW / points.length,
          height: plotH,
          fill: 'transparent',
        }),
        createElement('circle', {
          cx,
          cy,
          r: isSelected ? 5 : 2.6,
          fill: isSelected ? '#10b981' : '#fde68a',
          stroke: isSelected ? '#ffffff' : '#92400e',
          strokeWidth: isSelected ? 1.6 : 1,
        }),
        showLabel
          ? createElement(
              'text',
              {
                x: cx,
                y: height - 8,
                textAnchor: 'middle',
                fill: isSelected ? '#f5b942' : isDark ? '#94a3b8' : '#7a756c',
                fontSize: '9',
                fontWeight: isSelected ? '700' : '400',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              },
              p.label,
            )
          : null,
      );
    }),
    // Active Point Readout Badge on Chart
    createElement(
      'g',
      null,
      createElement('rect', {
        x: Math.max(padL, Math.min(width - padR - 148, activeX - 74)),
        y: Math.max(4, activeY - 26),
        width: 148,
        height: 19,
        rx: 5,
        fill: isDark ? 'rgba(24, 24, 27, 0.92)' : 'rgba(255, 255, 255, 0.94)',
        stroke: '#f5b942',
        strokeWidth: 1,
      }),
      createElement(
        'text',
        {
          x: Math.max(padL + 74, Math.min(width - padR - 74, activeX)),
          y: Math.max(17, activeY - 13),
          textAnchor: 'middle',
          fill: isDark ? '#fde68a' : '#92560c',
          fontSize: '9.5',
          fontWeight: '700',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        },
        `${activePt.yearMonth} · ¥${(activePt.compoundWealthCny / 10000).toFixed(1)}w (+${(activePt.gainCny / 10000).toFixed(1)}w)`,
      ),
    ),
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

  // Interactive panels & Scrubber index
  const [scrubPointIdx, setScrubPointIdx] = useState<number>(15);
  const [showShortcutsGuide, setShowShortcutsGuide] = useState(false);
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [newRecTitle, setNewRecTitle] = useState('');
  const [newRecAmount, setNewRecAmount] = useState('');
  const [newRecDay, setNewRecDay] = useState('1');
  const [newRecKind, setNewRecKind] = useState<LedgerEntryKind>('expense');
  const [newRecOwner, setNewRecOwner] = useState<LedgerOwnerId>('shared');

  const [showPartnerMergeBox, setShowPartnerMergeBox] = useState(false);
  const [partnerJsonDraft, setPartnerJsonDraft] = useState('');
  const [editingPartnerNames, setEditingPartnerNames] = useState(false);
  const [myNameDraft, setMyNameDraft] = useState(state.coupleProfile.myName);
  const [partnerNameDraft, setPartnerNameDraft] = useState(state.coupleProfile.partnerName);

  // Quick Preset Amount Prompt & Custom Preset Manager
  const [activePresetPrompt, setActivePresetPrompt] = useState<QuickLedgerPreset | null>(null);
  const [presetAmountDraft, setPresetAmountDraft] = useState('');
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [newPresetTitle, setNewPresetTitle] = useState('');
  const [newPresetPrice, setNewPresetPrice] = useState('');
  const [newPresetFixed, setNewPresetFixed] = useState(true);
  const [newPresetCategory, setNewPresetCategory] = useState<LedgerCategoryId>('transit');
  const [newPresetAccount, setNewPresetAccount] = useState<LedgerAccountId>('applepay');
  const [newPresetOwner, setNewPresetOwner] = useState<LedgerOwnerId>('me');

  // Multi-Ledger & Pooled Funds View ('pool' aggregates all pooled ledgers, or specific ledgerId)
  const [activeLedgerScope, setActiveLedgerScope] = useState<LedgerScopeId>('pool');
  const [targetWriteLedgerId, setTargetWriteLedgerId] = useState<LedgerBookId>('ledger-daily');
  const [showLedgerManager, setShowLedgerManager] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookBudget, setNewBookBudget] = useState('3000');
  const [newBookIncludePool, setNewBookIncludePool] = useState(true);

  // In-App Friend Pairing & Couple Chat Drawer
  const [showCoupleChatDrawer, setShowCoupleChatDrawer] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [quotedTxForChat, setQuotedTxForChat] = useState<CoupleChatMessage['linkedTx'] | undefined>(undefined);
  const [friendCodeDraft, setFriendCodeDraft] = useState(state.coupleProfile.partnerFriendCode || 'VS-6612');
  const [roomCodeDraft, setRoomCodeDraft] = useState(state.coupleProfile.roomCode || 'LOVE-88');
  const [showFriendPairBox, setShowFriendPairBox] = useState(false);
  const [syncStatus, setSyncStatus] = useState(getCoupleSyncStatus);
  const [cloudUrlDraft, setCloudUrlDraft] = useState(() => getCoupleSyncStatus().customUrl);
  const [cloudKeyDraft, setCloudKeyDraft] = useState(() => getCoupleSyncStatus().customAnonKey);
  const [editingAccountInitId, setEditingAccountInitId] = useState<LedgerAccountId | null>(null);
  const [accountInitDraft, setAccountInitDraft] = useState('');
  const [expandCompactDetails, setExpandCompactDetails] = useState(false);
  const showFullPanels = !compact || expandCompactDetails;
  const hasDemoSeeds = state.transactions.some((tx) => tx.id.startsWith('tx-seed-'));

  useEffect(() => {
    ensureRangeSliderCss();
    const unsubStore = subscribeBookkeepingStore(() => {
      setState(readBookkeepingState());
    });
    const unsubRealtime = connectCoupleRealtimeRoom(
      state.coupleProfile.roomCode || 'LOVE-88',
      (incoming) => {
        const rawJson = JSON.stringify(incoming);
        const { addedTxCount, addedChatCount } = importPartnerBookkeepingJson(rawJson);
        if (addedTxCount > 0 || addedChatCount > 0) {
          playCashRegisterTick('income');
        }
      },
    );
    ensureRecurringRulesApplied(localDay);
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.search) {
      const parsedUrlTx = parseAutoLogUrlParams(window.location.search);
      if (parsedUrlTx) {
        addLedgerTransaction({
          ...parsedUrlTx,
          localDay,
        });
        playCashRegisterTick(parsedUrlTx.kind);
        showToast({
          text: `iOS 快捷指令已自动入账：${parsedUrlTx.note} ${parsedUrlTx.kind === 'expense' ? '-' : '+'}¥${parsedUrlTx.amountCny.toFixed(2)}`,
        });
        try {
          const cleanUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, '', cleanUrl);
        } catch {
          // Ignore history error
        }
      }
    }
    return () => {
      unsubStore();
      unsubRealtime();
    };
  }, [localDay, state.coupleProfile.roomCode]);

  const pal = isDark
    ? {
        bg: '#121110',
        cardBg: '#18181b',
        cardElevated: '#1f1e22',
        border: 'rgba(255, 255, 255, 0.10)',
        goldBorder: 'rgba(245, 185, 66, 0.32)',
        pinkBorder: 'rgba(244, 114, 182, 0.30)',
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
        pillActiveBg: 'rgba(245, 185, 66, 0.16)',
        inputBg: 'rgba(12, 10, 9, 0.72)',
      }
    : {
        bg: '#f5f2eb',
        cardBg: '#ffffff',
        cardElevated: '#faf8f3',
        border: 'rgba(38, 36, 31, 0.11)',
        goldBorder: 'rgba(184, 130, 40, 0.32)',
        pinkBorder: 'rgba(219, 39, 119, 0.25)',
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
        pillActiveBg: 'rgba(204, 120, 92, 0.14)',
        inputBg: '#f4f1ea',
      };

  const ledgerBooks = state.ledgerBooks && state.ledgerBooks.length > 0 ? state.ledgerBooks : DEFAULT_LEDGER_BOOKS;
  const chatMessages = state.chatMessages ?? DEFAULT_COUPLE_CHAT_MESSAGES;
  const effectiveWriteLedgerId = activeLedgerScope === 'pool' ? targetWriteLedgerId : activeLedgerScope;

  const summary = useMemo(
    () => computeMonthlyBookkeepingSummary(state, localDay, activeLedgerScope),
    [state, localDay, activeLedgerScope],
  );
  const poolBreakdown = useMemo(
    () => computeMultiLedgerPoolBreakdown(state, summary.yearMonth),
    [state, summary.yearMonth],
  );
  const wealthTrajectory = useMemo(
    () =>
      computeWealthGoalTrajectory({
        wealthPlan: state.wealthPlan,
        recurringRules: state.recurringRules,
        fallbackMonthlyIncomeCny: poolBreakdown.pooledMonthIncomeCny || summary.totalIncomeCny || 30000,
        currentYearMonth: summary.yearMonth,
      }),
    [state.wealthPlan, state.recurringRules, poolBreakdown.pooledMonthIncomeCny, summary.totalIncomeCny, summary.yearMonth],
  );

  const scopeFilteredTransactions = useMemo(
    () => filterTransactionsByLedgerScope(state.transactions, ledgerBooks, activeLedgerScope),
    [state.transactions, ledgerBooks, activeLedgerScope],
  );

  const ownerFilteredTransactions = useMemo(
    () =>
      filterOwner === 'all'
        ? scopeFilteredTransactions
        : scopeFilteredTransactions.filter((tx) => (tx.owner ?? 'me') === filterOwner),
    [scopeFilteredTransactions, filterOwner],
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
    () => computeAccountBalances(ownerFilteredTransactions, state.accountInitialBalances),
    [ownerFilteredTransactions, state.accountInitialBalances],
  );

  const visibleCategories = useMemo(
    () => LEDGER_CATEGORIES.filter((c) => c.kind === entryKind),
    [entryKind],
  );

  const groupedDays = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = ownerFilteredTransactions.filter((tx) => {
      if (filterCat !== 'all' && tx.categoryId !== filterCat) return false;
      if (filterAcc !== 'all' && tx.accountId !== filterAcc) return false;
      if (filterDay && tx.localDay !== filterDay) return false;
      if (q) {
        const cat = getLedgerCategoryMeta(tx.categoryId);
        const acc = getLedgerAccountMeta(tx.accountId);
        const book = getLedgerBookMeta(tx.ledgerId, ledgerBooks);
        const hay = `${tx.note} ${cat.zh} ${cat.en} ${acc.zh} ${acc.en} ${book.zh} ${tx.amountCny}`.toLowerCase();
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
  }, [ownerFilteredTransactions, filterCat, filterAcc, filterDay, searchQuery, ledgerBooks]);

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
      ledgerId: effectiveWriteLedgerId,
      localDay: filterDay ?? localDay,
    });
    setState(next);
    setLastAddedTxId(added.id);
    setSmartInput('');
    playCashRegisterTick(parsed.kind);
    recordPledgeReward(`记账打卡：${parsed.note} ¥${parsed.amountCny}`, localDay, 10);
    const cat = getLedgerCategoryMeta(parsed.categoryId);
    const ownerMeta = getOwnerBadgeMeta(parsed.owner, state.coupleProfile);
    const bookMeta = getLedgerBookMeta(added.ledgerId, ledgerBooks);
    showToast({
      text: t(
        `已入账 [${bookMeta.zh} · ${ownerMeta.zh}]：${cat.zh} · ${parsed.note} ${parsed.kind === 'expense' ? '-' : '+'}¥${parsed.amountCny.toFixed(2)}`,
        `Logged [${bookMeta.en} · ${ownerMeta.en}]: ${parsed.note} ${parsed.kind === 'expense' ? '-' : '+'}¥${parsed.amountCny.toFixed(2)}`,
      ),
    });
  }

  const quickPresets = state.quickPresets ?? QUICK_LEDGER_PRESETS;

  function executePresetLog(preset: QuickLedgerPreset, finalAmountCny: number) {
    const owner = preset.owner ?? selectedOwner;
    const ledgerId = activeLedgerScope === 'pool' ? (preset.ledgerId ?? targetWriteLedgerId) : activeLedgerScope;
    const { state: next, added } = addLedgerTransaction({
      kind: 'expense',
      amountCny: finalAmountCny,
      categoryId: preset.categoryId,
      accountId: preset.accountId,
      owner,
      ledgerId,
      note: t(preset.zh, preset.en),
      localDay: filterDay ?? localDay,
    });
    setState(next);
    setLastAddedTxId(added.id);
    setActivePresetPrompt(null);
    setPresetAmountDraft('');
    playCashRegisterTick('expense');
    recordPledgeReward(`闪记：${preset.zh}`, localDay, 10);
    const ownerMeta = getOwnerBadgeMeta(owner, state.coupleProfile);
    showToast({
      text: t(
        `已入账 [${ownerMeta.zh}]：${preset.zh} -¥${finalAmountCny}`,
        `Logged [${ownerMeta.en}]: ${preset.en} -¥${finalAmountCny}`,
      ),
    });
  }

  function handlePresetClick(preset: QuickLedgerPreset) {
    // Truly fixed-price item (e.g. Subway ¥3): 1-tap instant log
    if (preset.isFixedPrice) {
      executePresetLog(preset, preset.amountCny);
      return;
    }
    // Variable-price shortcut: open inline quick-amount prompt & pre-fill form
    setEntryKind('expense');
    setSelectedCategory(preset.categoryId);
    setSelectedAccount(preset.accountId);
    if (preset.owner) setSelectedOwner(preset.owner);
    setNoteInput(t(preset.zh, preset.en));
    setActivePresetPrompt((prev) => (prev?.id === preset.id ? null : preset));
    setPresetAmountDraft('');
  }

  function handleConfirmPresetPromptAmount(customAmt?: number) {
    if (!activePresetPrompt) return;
    const amt = customAmt ?? evaluateAmountExpression(presetAmountDraft);
    if (!amt || amt <= 0) {
      showToast({
        text: t(`请输入「${activePresetPrompt.zh}」本次金额`, `Enter amount for ${activePresetPrompt.en}`),
        tone: 'error',
      });
      return;
    }
    executePresetLog(activePresetPrompt, amt);
  }

  function handlePinActivePresetAsFixedPrice() {
    if (!activePresetPrompt) return;
    const amt = evaluateAmountExpression(presetAmountDraft) ?? activePresetPrompt.amountCny;
    if (!amt || amt <= 0) return;
    const next = saveQuickLedgerPreset({
      id: activePresetPrompt.id,
      zh: activePresetPrompt.zh,
      en: activePresetPrompt.en,
      amountCny: amt,
      isFixedPrice: true,
      categoryId: activePresetPrompt.categoryId,
      accountId: activePresetPrompt.accountId,
      owner: activePresetPrompt.owner ?? 'me',
    });
    setState(next);
    setActivePresetPrompt(null);
    setPresetAmountDraft('');
    showToast({
      text: t(
        `已将「${activePresetPrompt.zh}」设为固定价格 ¥${amt}，后续点击将直接入账`,
        `Set "${activePresetPrompt.en}" to fixed ¥${amt} (1-tap log)`,
      ),
    });
  }

  function handleAddNewPresetItem() {
    const title = newPresetTitle.trim();
    if (!title) {
      showToast({ text: t('请输入常用项名称（如：公交 / 早餐）', 'Enter shortcut name'), tone: 'error' });
      return;
    }
    const parsedAmt = evaluateAmountExpression(newPresetPrice) ?? 10;
    const next = saveQuickLedgerPreset({
      zh: title,
      en: title,
      amountCny: parsedAmt,
      isFixedPrice: newPresetFixed,
      categoryId: newPresetCategory,
      accountId: newPresetAccount,
      owner: newPresetOwner,
    });
    setState(next);
    setNewPresetTitle('');
    setNewPresetPrice('');
    showToast({
      text: newPresetFixed
        ? t(`已新增固定价常用品：${title} ¥${parsedAmt}`, `Added fixed shortcut: ${title} ¥${parsedAmt}`)
        : t(`已新增快捷项：${title}（点击后输入金额）`, `Added shortcut: ${title} (prompts for amount)`),
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
      ledgerId: effectiveWriteLedgerId,
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
    const bookMeta = getLedgerBookMeta(added.ledgerId, ledgerBooks);
    showToast({
      text: t(
        `已记入「${bookMeta.zh}」[${ownerMeta.zh}]：${cleanNote} ${entryKind === 'expense' ? '-' : '+'}¥${amountCny.toFixed(2)}`,
        `Saved to ${bookMeta.en} [${ownerMeta.en}]: ${cleanNote} ${entryKind === 'expense' ? '-' : '+'}¥${amountCny.toFixed(2)}`,
      ),
    });
  }

  function handleUndoLastTx() {
    if (!lastAddedTxId) return;
    const next = removeLedgerTransaction(lastAddedTxId);
    setState(next);
    setLastAddedTxId(null);
    playCashRegisterTick('undo');
    showToast({ text: t('已撤回上一笔账单', 'Undid last transaction') });
  }

  function handleSaveBudget() {
    const num = Number.parseInt(budgetDraft, 10);
    if (Number.isFinite(num) && num >= 100) {
      const targetLedger = activeLedgerScope === 'pool' ? undefined : activeLedgerScope;
      const next = updateMonthlyBudgetCny(num, targetLedger);
      setState(next);
      setBudgetDraft(String(num));
      showToast({
        text: t(
          `月预算已更新为 ¥${num.toLocaleString('en-US')}`,
          `Monthly budget updated to ¥${num.toLocaleString('en-US')}`,
        ),
      });
    }
    setEditingBudget(false);
  }

  function handleCreateLedgerBook() {
    const title = newBookTitle.trim();
    if (!title) {
      showToast({ text: t('请输入新账本名称（如：装修专账 / 育儿账本）', 'Enter new ledger name'), tone: 'error' });
      return;
    }
    const budget = Number.parseInt(newBookBudget, 10) || 3000;
    const next = saveLedgerBook({
      zh: title,
      en: title,
      monthlyBudgetCny: budget,
      includeInPool: newBookIncludePool,
    });
    setState(next);
    setNewBookTitle('');
    showToast({
      text: t(
        `已新建账本「${title}」（${newBookIncludePool ? '已纳入家庭资金合池统计' : '独立核算'}）`,
        `Created ledger "${title}"`,
      ),
    });
  }

  function handleSendChat() {
    if (!chatInput.trim()) return;
    const next = sendCoupleChatMessage({
      sender: 'me',
      text: chatInput.trim(),
      linkedTx: quotedTxForChat,
    });
    setState(next);
    setChatInput('');
    setQuotedTxForChat(undefined);
    playCashRegisterTick('income');
  }

  function handleBindFriendRoom() {
    const next = bindCoupleFriendAndRoom({
      partnerFriendCode: friendCodeDraft,
      roomCode: roomCodeDraft,
      partnerName: state.coupleProfile.partnerName,
    });
    setState(next);
    setShowFriendPairBox(false);
    playCashRegisterTick('income');
    showToast({
      text: t(
        `已绑定伴侣好友码 ${friendCodeDraft.toUpperCase()} · 联机房间 #${roomCodeDraft.toUpperCase()}`,
        `Bound friend ${friendCodeDraft.toUpperCase()} in room #${roomCodeDraft.toUpperCase()}`,
      ),
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
        `已新增周期自动入账规则：每月 ${dayNum} 日「${title}」`,
        `Added recurring rule on day ${dayNum}: "${title}"`,
      ),
    });
  }

  async function handleCopyPartnerSyncCode() {
    const json = JSON.stringify(state, null, 2);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(json);
      showToast({
        text: t(
          `已复制双人家庭账本同步码，发送给${state.coupleProfile.partnerName}粘贴即可无损合并双方账单`,
          'Copied Couple Co-Op sync JSON! Send to your partner to merge.',
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
          `双人账本合并完成，新增同步了 ${addedTxCount} 笔来自${merged.coupleProfile.partnerName}的账单`,
          `Merged ${addedTxCount} new transactions from partner`,
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
          '已复制 iOS 快捷指令唤起 URL 模板到剪贴板',
          'Copied iOS Shortcuts auto-log URL template',
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
        showToast({ text: t(`已导出账单明细 ${filename}`, `Exported ${filename}`) });
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
  const activeScrubPoint =
    wealthTrajectory.points[Math.max(0, Math.min(wealthTrajectory.points.length - 1, scrubPointIdx))] ??
    wealthTrajectory.points[wealthTrajectory.points.length - 1]!;

  return (
    <View style={[styles.container, { backgroundColor: pal.bg, borderColor: pal.goldBorder }]}>
      {/* 0. Couple Co-Op Team Bar (Clean Editorial Style, No Emojis) */}
      <View
        style={[
          styles.coupleBanner,
          { backgroundColor: pal.cardElevated, borderBottomColor: pal.border },
        ]}
      >
        <View style={styles.coupleLeftCluster}>
          <View style={[styles.coupleAvatarPill, { backgroundColor: pal.pillActiveBg, borderColor: pal.goldBorder }]}>
            <Text variant="caption" style={{ color: pal.goldText, fontWeight: '700', fontSize: 11 }}>
              {`${state.coupleProfile.myName} & ${state.coupleProfile.partnerName} · ${t('双人共管账本', 'Couple Co-Op')}`}
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
                <Text variant="caption" style={{ color: pal.goldText, fontSize: 10, fontWeight: '700' }}>保存</Text>
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
              <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5, fontFamily: theme.fontFamily.mono }}>
                {t(
                  `协同 ${state.coupleProfile.teamStreakDays}d · ${state.coupleProfile.myName}支 ¥${summary.byOwner.meExpenseCny.toFixed(0)} · ${state.coupleProfile.partnerName}支 ¥${summary.byOwner.partnerExpenseCny.toFixed(0)} · 共同 ¥${summary.byOwner.sharedExpenseCny.toFixed(0)} [编辑]`,
                  `Streak ${state.coupleProfile.teamStreakDays}d · Me ¥${summary.byOwner.meExpenseCny.toFixed(0)} · Partner ¥${summary.byOwner.partnerExpenseCny.toFixed(0)} · Joint ¥${summary.byOwner.sharedExpenseCny.toFixed(0)} [Edit]`,
                )}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.coupleRightActions}>
          {(
            [
              { id: 'all', label: t('全部', 'All') },
              { id: 'me', label: state.coupleProfile.myName },
              { id: 'partner', label: state.coupleProfile.partnerName },
              { id: 'shared', label: t('共同', 'Joint') },
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
                    backgroundColor: active ? pal.pillActiveBg : pal.pillBg,
                    borderColor: active ? pal.gold : pal.border,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{
                    fontSize: 10.5,
                    fontWeight: active ? '700' : '500',
                    color: active ? pal.goldText : pal.sub,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="打开双人好友配对与联机房间"
            onPress={() => setShowFriendPairBox((prev) => !prev)}
            style={[
              styles.microBtn,
              {
                backgroundColor: showFriendPairBox ? pal.pillActiveBg : pal.pillBg,
                borderColor: syncStatus.isCloudRealtime ? pal.emerald : pal.goldBorder,
              },
            ]}
          >
            <Text
              variant="caption"
              style={{
                color: syncStatus.isCloudRealtime ? pal.emerald : pal.goldText,
                fontSize: 10.5,
                fontWeight: '700',
              }}
            >
              {syncStatus.isCloudRealtime
                ? t(`云端在线 #${state.coupleProfile.roomCode || 'LOVE-88'}`, `Cloud #${state.coupleProfile.roomCode || 'LOVE-88'}`)
                : t(`本机房间 #${state.coupleProfile.roomCode || 'LOVE-88'} [配云端]`, `Local #${state.coupleProfile.roomCode || 'LOVE-88'}`)}
            </Text>
          </Pressable>
          {hasDemoSeeds ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="一键清空内置演示数据并开启真实账本"
              onPress={() => {
                const next = clearDemoBookkeepingData();
                setState(next);
                showToast({
                  text: t('已清空全部内置演示账单，现在可开始记录你的真实收支', 'Cleared demo seed transactions'),
                });
              }}
              style={[styles.microBtn, { backgroundColor: `${pal.terracotta}18`, borderColor: pal.terracotta }]}
            >
              <Text variant="caption" style={{ color: pal.terracotta, fontSize: 10.5, fontWeight: '700' }}>
                {t('清空演示数据', 'Clear Demo')}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="打开App内双人聊天与账单互动窗口"
            onPress={() => setShowCoupleChatDrawer((prev) => !prev)}
            style={[
              styles.microBtn,
              {
                backgroundColor: showCoupleChatDrawer ? `${pal.pink}24` : pal.pillBg,
                borderColor: pal.pink,
              },
            ]}
          >
            <Text variant="caption" style={{ color: pal.pink, fontSize: 10.5, fontWeight: '700' }}>
              {t(`双人聊天 (${chatMessages.length})`, `Couple Chat (${chatMessages.length})`)}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="复制双人账本同步码发给老婆"
            onPress={() => void handleCopyPartnerSyncCode()}
            style={[styles.microBtn, { backgroundColor: pal.pillBg, borderColor: pal.border }]}
          >
            <Text variant="caption" style={{ color: pal.ink, fontSize: 10.5, fontWeight: '600' }}>
              {t('备份同步码', 'Backup Sync')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="合并老婆发来的账本同步码"
            onPress={() => setShowPartnerMergeBox((prev) => !prev)}
            style={[styles.microBtn, { backgroundColor: pal.pillBg, borderColor: pal.border }]}
          >
            <Text variant="caption" style={{ color: pal.ink, fontSize: 10.5, fontWeight: '600' }}>
              {t('导入合并', 'Import')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="打开 iOS 快捷指令自动记账配置向导"
            onPress={() => setShowShortcutsGuide((prev) => !prev)}
            style={[styles.microBtn, { backgroundColor: pal.pillBg, borderColor: pal.emerald }]}
          >
            <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, fontWeight: '700' }}>
              {t('iOS 自动记账', 'iOS Auto-Log')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 0.1 Multi-Ledger Switcher & Pooled Funds Aggregation Bar (多账本管理 + 资金合池统计) */}
      <View
        style={[
          styles.coupleBanner,
          {
            backgroundColor: pal.cardBg,
            borderBottomColor: pal.border,
            paddingVertical: 8,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, flex: 1 }}>
          <Text variant="caption" style={{ color: pal.muted, fontSize: 10.5, fontWeight: '600' }}>
            {t('多账本与合池：', 'Ledgers & Pool:')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="切换至全账本资金合池统计总览"
            onPress={() => setActiveLedgerScope('pool')}
            style={[
              styles.microBtn,
              {
                backgroundColor: activeLedgerScope === 'pool' ? pal.pillActiveBg : pal.pillBg,
                borderColor: activeLedgerScope === 'pool' ? pal.gold : pal.border,
              },
            ]}
          >
            <Text
              variant="caption"
              style={{
                color: activeLedgerScope === 'pool' ? pal.goldText : pal.ink,
                fontSize: 11,
                fontWeight: activeLedgerScope === 'pool' ? '700' : '600',
              }}
            >
              {t(`合池总览 (${summary.pooledLedgerCount}/${ledgerBooks.length} 账本合池)`, `Fund Pool (${summary.pooledLedgerCount}/${ledgerBooks.length})`)}
            </Text>
          </Pressable>

          {ledgerBooks.map((book) => {
            const isSelected = activeLedgerScope === book.id;
            return (
              <Pressable
                key={book.id}
                accessibilityRole="button"
                accessibilityLabel={`切换至账本 ${book.zh}`}
                onPress={() => {
                  setActiveLedgerScope(book.id);
                  setTargetWriteLedgerId(book.id);
                }}
                style={[
                  styles.microBtn,
                  {
                    backgroundColor: isSelected ? `${book.color}22` : pal.pillBg,
                    borderColor: isSelected ? book.color : pal.border,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{
                    color: isSelected ? book.color : pal.ink,
                    fontSize: 11,
                    fontWeight: isSelected ? '700' : '500',
                  }}
                >
                  {`[${book.icon}] ${t(book.zh, book.en)}${book.includeInPool ? '' : t(' (独立)', ' (Solo)')}`}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {activeLedgerScope === 'pool' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text variant="caption" style={{ color: pal.muted, fontSize: 10 }}>
                {t('新账单记入：', 'Log into:')}
              </Text>
              {ledgerBooks.map((book) => {
                const isTarget = targetWriteLedgerId === book.id;
                return (
                  <Pressable
                    key={`target-${book.id}`}
                    onPress={() => setTargetWriteLedgerId(book.id)}
                    style={[
                      styles.microBtn,
                      {
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        backgroundColor: isTarget ? pal.pillActiveBg : pal.pillBg,
                        borderColor: isTarget ? pal.gold : pal.border,
                      },
                    ]}
                  >
                    <Text variant="caption" style={{ color: isTarget ? pal.goldText : pal.sub, fontSize: 9.5, fontWeight: isTarget ? '700' : '500' }}>
                      {book.zh.slice(0, 4)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="管理多账本与资金合池开关"
            onPress={() => setShowLedgerManager((prev) => !prev)}
            style={[
              styles.microBtn,
              {
                backgroundColor: showLedgerManager ? pal.pillActiveBg : pal.pillBg,
                borderColor: showLedgerManager ? pal.gold : pal.border,
              },
            ]}
          >
            <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
              {showLedgerManager ? t('收起账本管理 ▲', 'Close Ledgers ▲') : t('多账本与合池管理 ✎', 'Manage Ledgers ✎')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Optional Drawer 0A: Multi-Ledger & Pooled Funds Breakdown Panel */}
      {showLedgerManager || activeLedgerScope === 'pool' ? (
        <View style={[styles.drawerPanel, { backgroundColor: pal.cardElevated, borderBottomColor: pal.border, paddingVertical: 10 }]}>
          <View style={styles.sectionTitleRow}>
            <Text variant="caption" style={{ color: pal.goldText, fontSize: 11.5, fontWeight: '700' }}>
              {t(
                `多账本资金合池统计（当前合池总月支出 ¥${poolBreakdown.pooledMonthExpenseCny.toLocaleString('en-US')} / 合池总预算 ¥${poolBreakdown.pooledMonthlyBudgetCny.toLocaleString('en-US')} · 合池净现金流 ${poolBreakdown.pooledNetCashflowCny >= 0 ? '+' : ''}¥${poolBreakdown.pooledNetCashflowCny.toLocaleString('en-US')}）`,
                `Multi-Ledger Fund Pool (Pooled Spend ¥${poolBreakdown.pooledMonthExpenseCny.toLocaleString('en-US')} / Pooled Budget ¥${poolBreakdown.pooledMonthlyBudgetCny.toLocaleString('en-US')})`,
              )}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {poolBreakdown.items.map((item) => {
              const isCurrent = activeLedgerScope === item.book.id;
              return (
                <View
                  key={`pool-card-${item.book.id}`}
                  style={{
                    flex: 1,
                    minWidth: 205,
                    padding: 9,
                    borderRadius: 9,
                    borderWidth: 1,
                    borderColor: isCurrent ? item.book.color : pal.border,
                    backgroundColor: pal.cardBg,
                    gap: 4,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <Pressable
                      onPress={() => {
                        setActiveLedgerScope(item.book.id);
                        setTargetWriteLedgerId(item.book.id);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                    >
                      <View style={[styles.monogramCircle, { width: 20, height: 20, backgroundColor: `${item.book.color}20`, borderColor: item.book.color }]}>
                        <Text variant="caption" style={{ color: item.book.color, fontSize: 10, fontWeight: '800' }}>
                          {item.book.icon}
                        </Text>
                      </View>
                      <Text variant="caption" style={{ color: pal.ink, fontSize: 11.5, fontWeight: '700' }}>
                        {t(item.book.zh, item.book.en)}
                      </Text>
                    </Pressable>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`切换 ${item.book.zh} 是否纳入资金合池`}
                        onPress={() => setState(toggleLedgerBookPoolInclusion(item.book.id))}
                        style={[
                          styles.microBtn,
                          {
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            backgroundColor: item.book.includeInPool ? `${pal.emerald}18` : pal.pillBg,
                            borderColor: item.book.includeInPool ? pal.emerald : pal.border,
                          },
                        ]}
                      >
                        <Text variant="caption" style={{ color: item.book.includeInPool ? pal.emerald : pal.muted, fontSize: 9.5, fontWeight: '700' }}>
                          {item.book.includeInPool ? t('✓ 已合池', '✓ Pooled') : t('独立核算', 'Solo')}
                        </Text>
                      </Pressable>
                      {item.book.id !== 'ledger-daily' && showLedgerManager ? (
                        <Pressable
                          onPress={() => {
                            setState(removeLedgerBook(item.book.id));
                            if (activeLedgerScope === item.book.id) setActiveLedgerScope('pool');
                          }}
                          style={[styles.microBtn, { paddingHorizontal: 5, paddingVertical: 2, backgroundColor: pal.pillBg, borderColor: pal.border }]}
                        >
                          <Text variant="caption" style={{ color: pal.muted, fontSize: 9.5 }}>×</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <Text variant="caption" style={{ color: pal.ink, fontFamily: theme.fontFamily.mono, fontSize: 12, fontWeight: '700' }}>
                      {`${t('支', 'Out')} ¥${item.monthExpenseCny.toLocaleString('en-US')} / ¥${item.book.monthlyBudgetCny.toLocaleString('en-US')}`}
                    </Text>
                    <Text variant="caption" style={{ color: pal.muted, fontSize: 9.5, fontFamily: theme.fontFamily.mono }}>
                      {item.book.includeInPool
                        ? t(`占合池 ${item.poolExpenseSharePct}% · ${item.txCount}笔`, `${item.poolExpenseSharePct}% of pool`)
                        : t(`独立账本 · ${item.txCount}笔`, `${item.txCount} tx`)}
                    </Text>
                  </View>
                  <View style={[styles.budgetProgressTrack, { height: 5, backgroundColor: pal.pillBg }]}>
                    <View
                      style={[
                        styles.budgetProgressFill,
                        {
                          width: `${Math.min(100, Math.max(4, item.budgetUsedPct))}%`,
                          backgroundColor: item.budgetUsedPct > 100 ? pal.danger : item.book.color,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>

          {showLedgerManager ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              <TextInput
                value={newBookTitle}
                onChangeText={setNewBookTitle}
                placeholder={t('新建账本名称（如：装修专账 / 个人零花账本）…', 'New ledger name…')}
                placeholderTextColor={pal.muted}
                style={[
                  styles.smartInput,
                  { height: 30, minWidth: 180, fontSize: 11, backgroundColor: pal.inputBg, borderColor: pal.border, color: pal.ink },
                ]}
              />
              <TextInput
                value={newBookBudget}
                onChangeText={setNewBookBudget}
                placeholder={t('月预算 ¥3000', 'Budget ¥3000')}
                placeholderTextColor={pal.muted}
                style={[
                  styles.budgetInput,
                  { height: 30, width: 90, fontSize: 11, backgroundColor: pal.inputBg, borderColor: pal.border, color: pal.goldText },
                ]}
              />
              <Pressable
                onPress={() => setNewBookIncludePool((prev) => !prev)}
                style={[
                  styles.microBtn,
                  {
                    height: 30,
                    justifyContent: 'center',
                    backgroundColor: newBookIncludePool ? `${pal.emerald}18` : pal.pillBg,
                    borderColor: newBookIncludePool ? pal.emerald : pal.border,
                  },
                ]}
              >
                <Text variant="caption" style={{ color: newBookIncludePool ? pal.emerald : pal.sub, fontSize: 10.5, fontWeight: '700' }}>
                  {newBookIncludePool ? t('纳入资金合池统计', 'Include in Pool') : t('独立账本不合池', 'Exclude from Pool')}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleCreateLedgerBook}
                style={[styles.microBtn, { height: 30, justifyContent: 'center', backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
              >
                <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                  {t('＋ 新建账本', '＋ Create Ledger')}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Optional Drawer 0B: In-App Friend Pairing & Room Binding */}
      {showFriendPairBox ? (
        <View style={[styles.drawerPanel, { backgroundColor: pal.cardElevated, borderBottomColor: pal.border }]}>
          <View style={styles.sectionTitleRow}>
            <Text variant="caption" style={{ color: pal.emerald, fontSize: 11.5, fontWeight: '700' }}>
              {t(
                `App 内加好友与双人联机配对（我的好友码：${state.coupleProfile.myFriendCode || 'VS-8829'} · 当前伴侣：${state.coupleProfile.partnerName} ${state.coupleProfile.partnerFriendCode || 'VS-6612'}）`,
                `In-App Friend Pairing (My Code: ${state.coupleProfile.myFriendCode || 'VS-8829'})`,
              )}
            </Text>
            <Pressable
              onPress={() => {
                const { addedTx } = simulatePartnerLiveSyncEvent(localDay);
                setState(readBookkeepingState());
                setShowCoupleChatDrawer(true);
                playCashRegisterTick('income');
                showToast({
                  text: t(
                    `收到来自${state.coupleProfile.partnerName}的实时同步账单「${addedTx.note} -¥${addedTx.amountCny}」与聊天消息`,
                    `Received live partner bill & chat message`,
                  ),
                });
              }}
              style={[styles.microBtn, { backgroundColor: `${pal.emerald}20`, borderColor: pal.emerald }]}
            >
              <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, fontWeight: '700' }}>
                {t(`测试收到${state.coupleProfile.partnerName}实时记账与消息`, 'Simulate Partner Live Sync')}
              </Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5 }}>
              {t('对方好友码：', 'Partner Friend Code:')}
            </Text>
            <TextInput
              value={friendCodeDraft}
              onChangeText={setFriendCodeDraft}
              placeholder="VS-6612"
              style={[styles.budgetInput, { height: 30, width: 92, backgroundColor: pal.inputBg, borderColor: pal.border, color: pal.ink }]}
            />
            <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5 }}>
              {t('双人联机房间号：', 'Shared Room Code:')}
            </Text>
            <TextInput
              value={roomCodeDraft}
              onChangeText={setRoomCodeDraft}
              placeholder="LOVE-88"
              style={[styles.budgetInput, { height: 30, width: 92, backgroundColor: pal.inputBg, borderColor: pal.gold, color: pal.goldText }]}
            />
            <Pressable
              onPress={handleBindFriendRoom}
              style={[styles.microBtn, { height: 30, justifyContent: 'center', backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
            >
              <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                {t('绑定好友并开启实时合池同步', 'Bind Friend & Sync')}
              </Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            <Text variant="caption" style={{ color: pal.muted, fontSize: 10 }}>
              {syncStatus.isCloudRealtime
                ? t('当前状态：已连接跨设备云端 Realtime 通道（异地双机秒级直连）', 'Status: Cloud Realtime Connected')
                : t('当前状态：本机双窗口 Broadcast 同步（填写 Supabase URL 与 Anon Key 即可开启异地双手机实时直连）：', 'Status: Local Broadcast (Enter Supabase URL & Key for cross-device cloud sync):')}
            </Text>
            <TextInput
              value={cloudUrlDraft}
              onChangeText={setCloudUrlDraft}
              placeholder="https://xxxx.supabase.co"
              placeholderTextColor={pal.muted}
              style={[styles.smartInput, { height: 28, minWidth: 170, fontSize: 10.5, backgroundColor: pal.inputBg, borderColor: pal.border, color: pal.ink }]}
            />
            <TextInput
              value={cloudKeyDraft}
              onChangeText={setCloudKeyDraft}
              placeholder="Supabase Public Anon Key"
              placeholderTextColor={pal.muted}
              style={[styles.smartInput, { height: 28, minWidth: 170, fontSize: 10.5, backgroundColor: pal.inputBg, borderColor: pal.border, color: pal.ink }]}
            />
            <Pressable
              onPress={() => {
                saveCoupleCloudRelayConfig(cloudUrlDraft, cloudKeyDraft);
                setSyncStatus(getCoupleSyncStatus());
                showToast({
                  text: cloudUrlDraft.trim()
                    ? t('已保存云端联机配置，已切换至跨设备实时同步模式', 'Saved cloud relay config')
                    : t('已切回本机离线同步模式', 'Switched to local mode'),
                });
              }}
              style={[styles.microBtn, { height: 28, justifyContent: 'center', backgroundColor: pal.pillBg, borderColor: pal.emerald }]}
            >
              <Text variant="caption" style={{ color: pal.emerald, fontSize: 10, fontWeight: '700' }}>
                {t('保存云端配置', 'Save Cloud Relay')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Optional Drawer 0C: In-App Couple Chat & Bill Comment Stream */}
      {showCoupleChatDrawer ? (
        <View style={[styles.drawerPanel, { backgroundColor: pal.cardElevated, borderBottomColor: pal.border, gap: 8 }]}>
          <View style={styles.sectionTitleRow}>
            <Text variant="caption" style={{ color: pal.pink, fontSize: 12, fontWeight: '700' }}>
              {t(
                `${state.coupleProfile.myName} & ${state.coupleProfile.partnerName} · App 内双人聊天与账单留言（房间 #${state.coupleProfile.roomCode || 'LOVE-88'}）`,
                `In-App Couple Chat & Bill Notes (#${state.coupleProfile.roomCode || 'LOVE-88'})`,
              )}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {[
                t('今日账单已记完，合池结余很稳', 'Daily bills logged, pool looks solid'),
                t('这笔算进我们的旅行心愿专账吧', 'Let us put this in our Travel Ledger'),
                t('周末双人晚餐预算还很充足', 'Plenty of budget for weekend dinner'),
              ].map((quickMsg) => (
                <Pressable
                  key={quickMsg}
                  onPress={() => {
                    const next = sendCoupleChatMessage({ sender: 'me', text: quickMsg, linkedTx: quotedTxForChat });
                    setState(next);
                    setQuotedTxForChat(undefined);
                    playCashRegisterTick('income');
                  }}
                  style={[styles.microBtn, { backgroundColor: pal.pillBg, borderColor: pal.border }]}
                >
                  <Text variant="caption" style={{ color: pal.sub, fontSize: 10 }}>
                    {quickMsg}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: 6, maxHeight: 210 }}>
            {chatMessages.slice(-6).map((msg) => {
              const isMe = msg.sender === 'me';
              const isSys = msg.sender === 'system';
              return (
                <View
                  key={msg.id}
                  style={{
                    alignSelf: isSys ? 'center' : isMe ? 'flex-end' : 'flex-start',
                    maxWidth: isSys ? '95%' : '82%',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 9,
                    borderWidth: 1,
                    borderColor: isSys ? pal.border : isMe ? pal.goldBorder : pal.pinkBorder,
                    backgroundColor: isSys ? pal.pillBg : isMe ? pal.pillActiveBg : `${pal.pink}16`,
                    gap: 3,
                  }}
                >
                  {!isSys ? (
                    <Text variant="caption" style={{ color: isMe ? pal.goldText : pal.pink, fontSize: 9.5, fontWeight: '700' }}>
                      {`${msg.senderName} · ${msg.createdAt.slice(11, 16)}`}
                    </Text>
                  ) : null}
                  {msg.linkedTx ? (
                    <View
                      style={{
                        paddingHorizontal: 7,
                        paddingVertical: 3,
                        borderRadius: 5,
                        backgroundColor: pal.cardBg,
                        borderLeftWidth: 2,
                        borderLeftColor: pal.gold,
                      }}
                    >
                      <Text variant="caption" style={{ color: pal.muted, fontSize: 9.5, fontFamily: theme.fontFamily.mono }}>
                        {`关联账单：${msg.linkedTx.ledgerTitle ? `[${msg.linkedTx.ledgerTitle}] ` : ''}${msg.linkedTx.note} ${msg.linkedTx.kind === 'expense' ? '-' : '+'}¥${msg.linkedTx.amountCny}`}
                      </Text>
                    </View>
                  ) : null}
                  <Text variant="caption" style={{ color: pal.ink, fontSize: 11.5 }}>
                    {msg.text}
                  </Text>
                </View>
              );
            })}
          </View>

          {quotedTxForChat ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: pal.cardBg, borderWidth: 1, borderColor: pal.goldBorder }}>
              <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5 }}>
                {`正在引用账单留言：[${quotedTxForChat.ledgerTitle ?? '账本'}] ${quotedTxForChat.note} ¥${quotedTxForChat.amountCny}`}
              </Text>
              <Pressable onPress={() => setQuotedTxForChat(undefined)}>
                <Text variant="caption" style={{ color: pal.muted, fontSize: 10.5 }}>× 取消引用</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={handleSendChat}
              placeholder={t(`给${state.coupleProfile.partnerName}发消息或讨论账单…`, 'Message your partner…')}
              placeholderTextColor={pal.muted}
              style={[
                styles.smartInput,
                { height: 34, backgroundColor: pal.inputBg, borderColor: pal.pinkBorder, color: pal.ink },
                Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : null,
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="发送双人聊天消息"
              onPress={handleSendChat}
              style={[styles.smartSubmitBtn, { height: 34, backgroundColor: `${pal.pink}24`, borderColor: pal.pink }]}
            >
              <Text variant="caption" style={{ color: pal.pink, fontSize: 11, fontWeight: '700' }}>
                {t('发送消息', 'Send')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Optional Drawer A: Partner Sync Merge Box */}
      {showPartnerMergeBox ? (
        <View style={[styles.drawerPanel, { backgroundColor: pal.cardElevated, borderBottomColor: pal.border }]}>
          <Text variant="caption" style={{ color: pal.ink, fontWeight: '700', fontSize: 11.5 }}>
            {t(
              `粘贴${state.coupleProfile.partnerName}发来的同步码（按账单 ID 无损去重合并，不覆盖已有记录）：`,
              'Paste partner sync JSON below to non-destructively merge transactions:',
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
              { backgroundColor: pal.inputBg, borderColor: pal.border, color: pal.ink },
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
              style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
            >
              <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                {t('确认无损合并', 'Merge Ledger')}
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
              {t('iOS 快捷指令「轻点背面两下」自动记账配置', 'iOS Shortcuts Back-Tap Auto-Bookkeeping Setup')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable
                onPress={() => void handleCopyShortcutUrlTemplate()}
                style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
              >
                <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                  {t('复制唤起 URL 模板', 'Copy Shortcut URL')}
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
                    showToast({ text: t('已模拟 iOS 快捷指令自动入账：瑞幸生椰拿铁 -¥18', 'Simulated iOS Shortcut Auto-Log: -¥18') });
                  }
                }}
                style={[styles.microBtn, { backgroundColor: `${pal.emerald}20`, borderColor: pal.emerald }]}
              >
                <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, fontWeight: '700' }}>
                  {t('测试自动入账', 'Test Auto-Log')}
                </Text>
              </Pressable>
            </View>
          </View>
          <Text variant="caption" style={{ color: pal.sub, fontSize: 11, lineHeight: 17 }}>
            {t(
              '1. 打开 iPhone「快捷指令」新建指令，添加动作「截屏」→「从图像中提取文本」；\n2. 添加动作「打开 URL」，填入 `/ledger?autoLog=[提取的文本]`；\n3. 在 iPhone「设置 → 辅助功能 → 触控 → 轻点背面 → 轻点两下」绑定该指令，付款后轻敲两下手机背面即可自动记账。',
              '1. In iOS Shortcuts, add "Take Screenshot" -> "Extract Text from Image"; 2. Add "Open URLs" with `/ledger?autoLog=[Extracted Text]`; 3. Bind to Settings -> Accessibility -> Touch -> Back Tap.',
            )}
          </Text>
        </View>
      ) : null}

      {/* 1. Top Monthly Budget & Safe-to-Spend Cockpit Header */}
      <View style={[styles.topCockpit, { backgroundColor: pal.cardElevated, borderBottomColor: pal.border }]}>
        <View style={styles.topMetricsRow}>
          <View style={[styles.metricCard, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
            <View style={styles.metricHeaderRow}>
              <Text variant="caption" style={{ color: pal.muted, fontSize: 11 }}>
                {t(`${summary.yearMonth} 本月累计支出`, `${summary.yearMonth} Monthly Spend`)}
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
                  {t(`月预算 ¥${summary.monthlyBudgetCny.toLocaleString('en-US')} [改]`, `Budget ¥${summary.monthlyBudgetCny.toLocaleString('en-US')}`)}
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
                ? t(`已超支 ¥${Math.abs(summary.remainingBudgetCny).toLocaleString('en-US')}`, `Over budget by ¥${Math.abs(summary.remainingBudgetCny).toLocaleString('en-US')}`)
                : t(
                    `已用 ${summary.budgetUsedPct}% · 剩余预算 ¥${summary.remainingBudgetCny.toLocaleString('en-US')}`,
                    `${summary.budgetUsedPct}% used · ¥${summary.remainingBudgetCny.toLocaleString('en-US')} left`,
                  )}
            </Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: pal.cardBg, borderColor: pal.goldBorder }]}>
            <View style={styles.metricHeaderRow}>
              <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontWeight: '700' }}>
                {t('今日安全可花额度', 'Safe-to-Spend Today')}
              </Text>
              <Text variant="caption" style={{ color: pal.muted, fontSize: 10.5 }}>
                {t(`本月余 ${summary.daysLeftInMonth} 天`, `${summary.daysLeftInMonth}d left`)}
              </Text>
            </View>
            <Text variant="title" style={[styles.bigAmountText, { color: pal.goldText }]}>
              {`¥${summary.dailySafeToSpendCny.toLocaleString('en-US')}`}
            </Text>
            <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5 }}>
              {t(
                `今日已支 ¥${summary.todayExpenseCny.toFixed(2)} · ${
                  summary.todayExpenseCny <= summary.dailySafeToSpendCny
                    ? '预算节奏正常'
                    : '超出日均预算'
                }`,
                `Today spent ¥${summary.todayExpenseCny.toFixed(2)}`,
              )}
            </Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
            <View style={styles.metricHeaderRow}>
              <Text variant="caption" style={{ color: pal.muted, fontSize: 11 }}>
                {t('本月总收入与净结余', 'Monthly Income & Net')}
              </Text>
              <Pressable onPress={() => void handleExportCsv()}>
                <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, fontWeight: '700' }}>
                  {t('导出 CSV', 'Export CSV')}
                </Text>
              </Pressable>
            </View>
            <Text variant="title" style={[styles.bigAmountText, { color: pal.emerald }]}>
              {`+¥${summary.totalIncomeCny.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </Text>
            <Text variant="caption" style={{ color: pal.sub, fontSize: 10.5 }}>
              {t(
                `净结余 ${summary.netCashflowCny >= 0 ? '+' : ''}¥${summary.netCashflowCny.toLocaleString('en-US')}（${state.coupleProfile.myName} ¥${summary.byOwner.meIncomeCny.toLocaleString('en-US')} / ${state.coupleProfile.partnerName} ¥${summary.byOwner.partnerIncomeCny.toLocaleString('en-US')}）`,
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
                '输入自然语言快速记账（如：瑞幸拿铁 18 微信 / 老婆买茶饮 22 / 盒马买菜 128 支付宝）…',
                'Quick Log (e.g. Latte 18 WeChat / Partner Tea 22 / Groceries 128 Alipay)…',
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
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <Text variant="caption" style={{ color: pal.goldText, fontWeight: '700', fontSize: 11.5 }}>
                {t('快速入账', 'Quick Log')}
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
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  },
                ]}
              >
                <Text variant="caption" style={{ color: pal.sub, fontWeight: '600', fontSize: 11 }}>
                  {t('↺ 撤回上笔', '↺ Undo')}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.presetRow}>
            <Text variant="caption" style={{ color: pal.muted, fontSize: 10.5 }}>
              {t('常用快记：', 'Shortcuts:')}
            </Text>
            {quickPresets.map((preset) => {
              const isFixed = Boolean(preset.isFixedPrice);
              const isPrompting = activePresetPrompt?.id === preset.id;
              return (
                <Pressable
                  key={preset.id}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isFixed
                      ? `固定价闪记 ${preset.zh} ${preset.amountCny}元`
                      : `点击输入 ${preset.zh} 金额`
                  }
                  onPress={() => handlePresetClick(preset)}
                  style={({ pressed }) => [
                    styles.presetChip,
                    {
                      backgroundColor: isPrompting
                        ? pal.pillActiveBg
                        : isFixed
                          ? `${pal.emerald}16`
                          : pal.pillBg,
                      borderColor: isPrompting
                        ? pal.gold
                        : isFixed
                          ? pal.emerald
                          : pal.border,
                      transform: [{ scale: pressed ? 0.94 : 1 }],
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: pal.ink, fontSize: 11, fontWeight: '600' }}>
                    {`${t(preset.zh, preset.en)} `}
                    <Text
                      variant="caption"
                      style={{
                        color: isFixed ? pal.emerald : pal.goldText,
                        fontWeight: '700',
                        fontSize: 10.5,
                      }}
                    >
                      {isFixed ? `¥${preset.amountCny}` : t('· 填金额', '· Amount')}
                    </Text>
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="设置常用品与固定价格"
              onPress={() => setShowPresetManager((prev) => !prev)}
              style={({ pressed }) => [
                styles.presetChip,
                {
                  backgroundColor: showPresetManager ? pal.pillActiveBg : pal.pillBg,
                  borderColor: showPresetManager ? pal.gold : pal.border,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                },
              ]}
            >
              <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                {showPresetManager ? t('收起设置 ▲', 'Done ▲') : t('设置常用品 ✎', 'Configure ✎')}
              </Text>
            </Pressable>
          </View>

          {/* Instant Inline Amount Entry Bar when a variable-price shortcut is clicked */}
          {activePresetPrompt ? (
            <View
              style={[
                styles.drawerPanel,
                {
                  backgroundColor: pal.cardBg,
                  borderColor: pal.goldBorder,
                  borderWidth: 1,
                  borderRadius: 10,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <View style={[styles.monogramCircle, { backgroundColor: `${pal.gold}22`, width: 22, height: 22, borderRadius: 6 }]}>
                    <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '800' }}>
                      {activePresetPrompt.icon}
                    </Text>
                  </View>
                  <Text variant="caption" style={{ color: pal.ink, fontSize: 11.5, fontWeight: '700' }}>
                    {t(`快记「${activePresetPrompt.zh}」`, `Quick Log "${activePresetPrompt.en}"`)}
                  </Text>
                  <Text variant="caption" style={{ color: pal.muted, fontSize: 10.5 }}>
                    {`${getLedgerAccountMeta(activePresetPrompt.accountId).zh} · ${getOwnerBadgeMeta(activePresetPrompt.owner ?? selectedOwner, state.coupleProfile).zh}`}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    Math.max(1, Math.round(activePresetPrompt.amountCny * 0.7)),
                    activePresetPrompt.amountCny,
                    Math.round(activePresetPrompt.amountCny * 1.25),
                    Math.round(activePresetPrompt.amountCny * 1.6),
                  ]
                    .filter((v, i, arr) => arr.indexOf(v) === i)
                    .map((cand) => (
                      <Pressable
                        key={`cand-${cand}`}
                        onPress={() => handleConfirmPresetPromptAmount(cand)}
                        style={[styles.microBtn, { backgroundColor: pal.pillBg, borderColor: pal.border }]}
                      >
                        <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700', fontFamily: theme.fontFamily.mono }}>
                          {`¥${cand}`}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <TextInput
                  value={presetAmountDraft}
                  onChangeText={setPresetAmountDraft}
                  onSubmitEditing={() => handleConfirmPresetPromptAmount()}
                  autoFocus
                  placeholder={t(`输入本次金额（参考 ¥${activePresetPrompt.amountCny}，支持 25+8 算式）…`, `Enter amount (ref ¥${activePresetPrompt.amountCny})…`)}
                  placeholderTextColor={pal.muted}
                  style={[
                    styles.smartInput,
                    {
                      height: 34,
                      minWidth: 180,
                      backgroundColor: pal.inputBg,
                      borderColor: pal.gold,
                      color: pal.ink,
                      fontFamily: theme.fontFamily.mono,
                    },
                    Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as ViewStyle) : null,
                  ]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="确认快捷金额入账"
                  onPress={() => handleConfirmPresetPromptAmount()}
                  style={[styles.smartSubmitBtn, { height: 34, backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
                >
                  <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontWeight: '700' }}>
                    {t('确认入账', 'Confirm Log')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="将当前金额设为固定价格常用品"
                  onPress={handlePinActivePresetAsFixedPrice}
                  style={[styles.microBtn, { height: 34, justifyContent: 'center', backgroundColor: `${pal.emerald}18`, borderColor: pal.emerald }]}
                >
                  <Text variant="caption" style={{ color: pal.emerald, fontSize: 10.5, fontWeight: '700' }}>
                    {t(
                      `设为固定价 ¥${evaluateAmountExpression(presetAmountDraft) ?? activePresetPrompt.amountCny}`,
                      `Pin Fixed ¥${evaluateAmountExpression(presetAmountDraft) ?? activePresetPrompt.amountCny}`,
                    )}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setActivePresetPrompt(null)}
                  style={[styles.microBtn, { height: 34, justifyContent: 'center', backgroundColor: pal.pillBg, borderColor: pal.border }]}
                >
                  <Text variant="caption" style={{ color: pal.muted, fontSize: 10.5 }}>
                    {t('取消', 'Cancel')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* Custom Preset & Fixed-Price Manager Drawer */}
          {showPresetManager ? (
            <View
              style={[
                styles.drawerPanel,
                {
                  backgroundColor: pal.cardBg,
                  borderColor: pal.border,
                  borderWidth: 1,
                  borderRadius: 10,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                },
              ]}
            >
              <Text variant="caption" style={{ color: pal.goldText, fontSize: 11.5, fontWeight: '700' }}>
                {t(
                  '常用品与固定价格设置（标记为「固定价」如地铁 ¥3 点击直接入账；标记为「填金额」点击后弹出金额框）',
                  'Shortcut Settings (Fixed-price items log in 1 tap; variable items prompt for amount on click)',
                )}
              </Text>
              <View style={{ gap: 6 }}>
                {quickPresets.map((item) => {
                  const isFixed = Boolean(item.isFixedPrice);
                  return (
                    <View
                      key={`cfg-${item.id}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8,
                        paddingVertical: 5,
                        paddingHorizontal: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: pal.border,
                        backgroundColor: pal.cardElevated,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text variant="caption" style={{ color: pal.ink, fontSize: 11, fontWeight: '700' }}>
                          {t(item.zh, item.en)}
                        </Text>
                        <Text variant="caption" style={{ color: pal.muted, fontSize: 10 }}>
                          {`${getLedgerCategoryMeta(item.categoryId).zh} · ${getLedgerAccountMeta(item.accountId).zh} · ${getOwnerBadgeMeta(item.owner ?? 'me', state.coupleProfile).zh}`}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Pressable
                          onPress={() => {
                            const next = saveQuickLedgerPreset({
                              id: item.id,
                              zh: item.zh,
                              en: item.en,
                              amountCny: item.amountCny,
                              isFixedPrice: !isFixed,
                              categoryId: item.categoryId,
                              accountId: item.accountId,
                              owner: item.owner ?? 'me',
                            });
                            setState(next);
                          }}
                          style={[
                            styles.microBtn,
                            {
                              backgroundColor: isFixed ? `${pal.emerald}20` : pal.pillBg,
                              borderColor: isFixed ? pal.emerald : pal.border,
                            },
                          ]}
                        >
                          <Text
                            variant="caption"
                            style={{
                              color: isFixed ? pal.emerald : pal.sub,
                              fontSize: 10,
                              fontWeight: '700',
                            }}
                          >
                            {isFixed ? t(`固定价 ¥${item.amountCny} · 一键直记`, `Fixed ¥${item.amountCny}`) : t(`点击填金额 (参考 ¥${item.amountCny})`, `Prompt Amount (¥${item.amountCny})`)}
                          </Text>
                        </Pressable>
                        {[3, 4, 6, 9.9, 18, 35].map((quickVal) => (
                          <Pressable
                            key={`qv-${item.id}-${quickVal}`}
                            onPress={() => {
                              const next = saveQuickLedgerPreset({
                                id: item.id,
                                zh: item.zh,
                                en: item.en,
                                amountCny: quickVal,
                                isFixedPrice: true,
                                categoryId: item.categoryId,
                                accountId: item.accountId,
                                owner: item.owner ?? 'me',
                              });
                              setState(next);
                            }}
                            style={[
                              styles.microBtn,
                              {
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                backgroundColor: isFixed && item.amountCny === quickVal ? pal.pillActiveBg : pal.pillBg,
                                borderColor: isFixed && item.amountCny === quickVal ? pal.gold : pal.border,
                              },
                            ]}
                          >
                            <Text variant="caption" style={{ color: pal.goldText, fontSize: 9.5, fontFamily: theme.fontFamily.mono }}>
                              {`¥${quickVal}`}
                            </Text>
                          </Pressable>
                        ))}
                        <Pressable
                          onPress={() => setState(removeQuickLedgerPreset(item.id))}
                          style={[styles.microBtn, { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: pal.pillBg, borderColor: pal.border }]}
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

              {/* Add New Custom Shortcut Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                <TextInput
                  value={newPresetTitle}
                  onChangeText={setNewPresetTitle}
                  placeholder={t('新增常用品名称（如：地铁通勤 / 早餐豆浆）', 'New item name (e.g. Subway / Soy Milk)')}
                  placeholderTextColor={pal.muted}
                  style={[
                    styles.smartInput,
                    {
                      height: 30,
                      minWidth: 160,
                      fontSize: 11,
                      backgroundColor: pal.inputBg,
                      borderColor: pal.border,
                      color: pal.ink,
                    },
                  ]}
                />
                <TextInput
                  value={newPresetPrice}
                  onChangeText={setNewPresetPrice}
                  placeholder={t('金额 ¥3', '¥3')}
                  placeholderTextColor={pal.muted}
                  style={[
                    styles.budgetInput,
                    {
                      height: 30,
                      width: 72,
                      fontSize: 11,
                      backgroundColor: pal.inputBg,
                      borderColor: pal.border,
                      color: pal.goldText,
                    },
                  ]}
                />
                <Pressable
                  onPress={() => setNewPresetFixed((prev) => !prev)}
                  style={[
                    styles.microBtn,
                    {
                      height: 30,
                      justifyContent: 'center',
                      backgroundColor: newPresetFixed ? `${pal.emerald}20` : pal.pillBg,
                      borderColor: newPresetFixed ? pal.emerald : pal.border,
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: newPresetFixed ? pal.emerald : pal.sub, fontSize: 10.5, fontWeight: '700' }}>
                    {newPresetFixed ? t('模式：固定价格直记', 'Mode: Fixed Price') : t('模式：点击后输入金额', 'Mode: Prompt Amount')}
                  </Text>
                </Pressable>
                {(['transit', 'coffee', 'dining', 'shopping'] as LedgerCategoryId[]).map((cid) => {
                  const c = getLedgerCategoryMeta(cid);
                  const active = newPresetCategory === cid;
                  return (
                    <Pressable
                      key={`np-cat-${cid}`}
                      onPress={() => setNewPresetCategory(cid)}
                      style={[
                        styles.microBtn,
                        {
                          height: 30,
                          justifyContent: 'center',
                          backgroundColor: active ? pal.pillActiveBg : pal.pillBg,
                          borderColor: active ? pal.gold : pal.border,
                        },
                      ]}
                    >
                      <Text variant="caption" style={{ color: active ? pal.goldText : pal.sub, fontSize: 10 }}>
                        {c.zh}
                      </Text>
                    </Pressable>
                  );
                })}
                {(['applepay', 'wechat', 'alipay'] as LedgerAccountId[]).map((aid) => {
                  const a = getLedgerAccountMeta(aid);
                  const active = newPresetAccount === aid;
                  return (
                    <Pressable
                      key={`np-acc-${aid}`}
                      onPress={() => setNewPresetAccount(aid)}
                      style={[
                        styles.microBtn,
                        {
                          height: 30,
                          justifyContent: 'center',
                          backgroundColor: active ? pal.pillActiveBg : pal.pillBg,
                          borderColor: active ? pal.gold : pal.border,
                        },
                      ]}
                    >
                      <Text variant="caption" style={{ color: active ? pal.goldText : pal.sub, fontSize: 10 }}>
                        {a.zh}
                      </Text>
                    </Pressable>
                  );
                })}
                {(['me', 'partner', 'shared'] as LedgerOwnerId[]).map((oid) => {
                  const o = getOwnerBadgeMeta(oid, state.coupleProfile);
                  const active = newPresetOwner === oid;
                  return (
                    <Pressable
                      key={`np-own-${oid}`}
                      onPress={() => setNewPresetOwner(oid)}
                      style={[
                        styles.microBtn,
                        {
                          height: 30,
                          justifyContent: 'center',
                          backgroundColor: active ? `${o.color}22` : pal.pillBg,
                          borderColor: active ? o.color : pal.border,
                        },
                      ]}
                    >
                      <Text variant="caption" style={{ color: active ? o.color : pal.sub, fontSize: 10 }}>
                        {o.zh}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={handleAddNewPresetItem}
                  style={[styles.microBtn, { height: 30, justifyContent: 'center', backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
                >
                  <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
                    {t('＋ 保存常用项', '＋ Add Shortcut')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {compact ? (
        <View style={{ paddingHorizontal: 14, paddingTop: 10, alignItems: 'flex-end' }}>
          <Pressable
            onPress={() => setExpandCompactDetails((prev) => !prev)}
            style={[styles.microBtn, { backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
          >
            <Text variant="caption" style={{ color: pal.goldText, fontSize: 10.5, fontWeight: '700' }}>
              {expandCompactDetails
                ? t('收起财富曲线与完整流水明细 ▲', 'Hide Full Ledger & Curve ▲')
                : t('展开财富曲线、分类键盘与完整流水明细 ▼', 'Expand Full Ledger & Curve ▼')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* 1.5. Continuous Slidable Salary × Investment Ratio -> Target Wealth Trajectory Curve Card */}
      {showFullPanels ? (
        <View style={[styles.wealthCardWrap, { backgroundColor: pal.cardBg, borderColor: pal.goldBorder }]}>
          <View style={styles.sectionTitleRow}>
            <View style={{ gap: 3, flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <View style={[styles.statusDot, { backgroundColor: pal.gold }]} />
                <Text variant="label" style={{ color: pal.goldText, fontSize: 13.5, fontWeight: '700' }}>
                  {t(
                    '薪资与定投比例 → 目标财富达成曲线（双人复利模型）',
                    'Salary × Investment Ratio → Target Wealth Compound Trajectory',
                  )}
                </Text>
              </View>
              <Text variant="caption" style={{ color: pal.ink, fontSize: 12, fontWeight: '600' }}>
                {wealthTrajectory.alreadyReached
                  ? t(
                      `当前本金 ¥${wealthTrajectory.currentSavedCny.toLocaleString('en-US')} 已达成 ¥${wealthTrajectory.targetWealthCny.toLocaleString('en-US')} 目标，可向右拖动目标滑块设定下一阶段目标。`,
                      `Current capital already exceeds target. Slide the target bar right to set your next milestone.`,
                    )
                  : t(
                      `按双人月收入 ¥${wealthTrajectory.monthlyIncomeCny.toLocaleString('en-US')} × 定投 ${wealthTrajectory.investRatePct}%（月投 ¥${wealthTrajectory.monthlyInvestCny.toLocaleString('en-US')} · 年化 ${wealthTrajectory.annualReturnPct.toFixed(1)}%），预计 ${wealthTrajectory.yearsPart > 0 ? `${wealthTrajectory.yearsPart} 年 ` : ''}${wealthTrajectory.monthsPart} 个月（${wealthTrajectory.estimatedGoalYearMonth}）达成 ¥${(wealthTrajectory.targetWealthCny / 10000).toFixed(0)} 万目标`,
                      `At ${wealthTrajectory.investRatePct}% invest rate (¥${wealthTrajectory.monthlyInvestCny.toLocaleString('en-US')}/mo @ ${wealthTrajectory.annualReturnPct.toFixed(1)}% APY), reaches ¥${(wealthTrajectory.targetWealthCny / 10000).toFixed(0)}w in ${wealthTrajectory.yearsPart}y ${wealthTrajectory.monthsPart}m (${wealthTrajectory.estimatedGoalYearMonth})`,
                    )}
              </Text>
            </View>
          </View>

          {/* 4 Continuous Draggable Sliders Grid */}
          <View style={styles.slidersGrid}>
            <InteractiveRangeSlider
              label={t('月薪定投比例', 'Invest Ratio')}
              valueText={`${state.wealthPlan.investRatePct}%`}
              subText={`¥${wealthTrajectory.monthlyInvestCny.toLocaleString('en-US')}/${t('月', 'mo')}`}
              value={state.wealthPlan.investRatePct}
              min={5}
              max={85}
              step={1}
              accentColor={pal.gold}
              trackBg={pal.pillBg}
              borderColor={pal.border}
              inkColor={pal.goldText}
              mutedColor={pal.muted}
              onChange={(val) => setState(updateWealthPlanConfig({ investRatePct: val }))}
            />

            <InteractiveRangeSlider
              label={t('预期年化收益率', 'Expected APY')}
              valueText={`${state.wealthPlan.annualReturnPct.toFixed(1)}%`}
              subText={
                state.wealthPlan.annualReturnPct <= 4.5
                  ? t('稳健固收', 'Conservative')
                  : state.wealthPlan.annualReturnPct <= 9.5
                    ? t('宽基指数', 'Index Core')
                    : t('进取权益', 'Growth')
              }
              value={state.wealthPlan.annualReturnPct}
              min={0}
              max={20}
              step={0.5}
              accentColor={pal.emerald}
              trackBg={pal.pillBg}
              borderColor={pal.border}
              inkColor={pal.emerald}
              mutedColor={pal.muted}
              onChange={(val) => setState(updateWealthPlanConfig({ annualReturnPct: val }))}
            />

            <InteractiveRangeSlider
              label={t('当前起始本金', 'Starting Capital')}
              valueText={`¥${(state.wealthPlan.currentSavedCny / 10000).toFixed(0)}w`}
              subText={`¥${state.wealthPlan.currentSavedCny.toLocaleString('en-US')}`}
              value={state.wealthPlan.currentSavedCny}
              min={0}
              max={5000000}
              step={10000}
              accentColor="#38bdf8"
              trackBg={pal.pillBg}
              borderColor={pal.border}
              inkColor={pal.ink}
              mutedColor={pal.muted}
              onChange={(val) => setState(updateWealthPlanConfig({ currentSavedCny: val }))}
            />

            <InteractiveRangeSlider
              label={t('阶段财富目标', 'Wealth Target')}
              valueText={`¥${(state.wealthPlan.targetWealthCny / 10000).toFixed(0)}w`}
              subText={`¥${state.wealthPlan.targetWealthCny.toLocaleString('en-US')}`}
              value={state.wealthPlan.targetWealthCny}
              min={100000}
              max={10000000}
              step={50000}
              accentColor={pal.gold}
              trackBg={pal.pillBg}
              borderColor={pal.border}
              inkColor={pal.goldText}
              mutedColor={pal.muted}
              onChange={(val) => setState(updateWealthPlanConfig({ targetWealthCny: val }))}
            />
          </View>

          {/* SVG Compound Wealth Curve with Interactive Scrubber */}
          <WealthTrajectorySvg
            points={wealthTrajectory.points}
            targetWealthCny={wealthTrajectory.targetWealthCny}
            activePointIdx={scrubPointIdx}
            onSelectPointIdx={setScrubPointIdx}
            isDark={isDark}
          />

          {/* Timeline Scrubber Slider Bar for Inspecting Any Point on the Curve */}
          <InteractiveRangeSlider
            label={t('滑动检视曲线时间节点', 'Scrub Timeline Node')}
            valueText={`${activeScrubPoint.yearMonth} (${activeScrubPoint.label})`}
            subText={t(
              `总资产 ¥${(activeScrubPoint.compoundWealthCny / 10000).toFixed(1)}w = 本金 ¥${(activeScrubPoint.principalCny / 10000).toFixed(1)}w + 复利 ¥${(activeScrubPoint.gainCny / 10000).toFixed(1)}w`,
              `Total ¥${(activeScrubPoint.compoundWealthCny / 10000).toFixed(1)}w (Prin ¥${(activeScrubPoint.principalCny / 10000).toFixed(1)}w + Gain ¥${(activeScrubPoint.gainCny / 10000).toFixed(1)}w)`,
            )}
            value={Math.max(0, Math.min(wealthTrajectory.points.length - 1, scrubPointIdx))}
            min={0}
            max={Math.max(1, wealthTrajectory.points.length - 1)}
            step={1}
            accentColor={pal.emerald}
            trackBg={pal.pillBg}
            borderColor={pal.border}
            inkColor={pal.goldText}
            mutedColor={pal.muted}
            onChange={(idx) => setScrubPointIdx(Math.round(idx))}
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
                <Text variant="caption" style={{ color: pal.emerald, fontSize: 9.5, fontFamily: theme.fontFamily.mono }}>
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
      {showFullPanels ? (
        <View style={styles.mainSplitGrid}>
          {/* Left Column: Visual Category Grid + Built-in Calculator Keypad + Recurring Rules */}
          <View style={[styles.leftPanelCard, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
            <View style={styles.sectionTitleRow}>
              <Text variant="label" style={{ color: pal.ink, fontSize: 13.5, fontWeight: '700' }}>
                {t('分类记账与算式键盘', 'Category & Calculator Pad')}
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

            {/* Member Attribution Selector */}
            <View style={styles.accountSelectorRow}>
              {(
                [
                  { id: 'me', label: state.coupleProfile.myName, color: '#38bdf8' },
                  { id: 'partner', label: state.coupleProfile.partnerName, color: '#f472b6' },
                  { id: 'shared', label: t('共同开销', 'Joint'), color: '#f5b942' },
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
                        backgroundColor: active ? `${ow.color}20` : pal.pillBg,
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
                      {ow.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Category Monogram Matrix */}
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
                        backgroundColor: active ? `${cat.color}20` : pal.pillBg,
                        borderColor: active ? cat.color : pal.border,
                        transform: [{ scale: pressed ? 0.95 : 1 }],
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.monogramCircle,
                        { backgroundColor: `${cat.color}24`, borderColor: `${cat.color}66` },
                      ]}
                    >
                      <Text variant="caption" style={{ fontSize: 11, fontWeight: '700', color: cat.color }}>
                        {cat.icon}
                      </Text>
                    </View>
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
                        backgroundColor: active ? `${acc.color}20` : pal.pillBg,
                        borderColor: active ? acc.color : pal.border,
                        transform: [{ scale: pressed ? 0.95 : 1 }],
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
                      {t(acc.zh, acc.en)}
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
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>
                    {t('确认记账', 'Save')}
                  </Text>
                </Pressable>
              </View>

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
                        transform: [{ scale: pressed ? 0.93 : 1 }],
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

            {/* Recurring Rules Section */}
            <View style={styles.walletSection}>
              <View style={styles.metricHeaderRow}>
                <Text variant="caption" style={{ color: pal.goldText, fontSize: 11, fontWeight: '700' }}>
                  {t('周期性固定收支自动入账（月薪 / 房贷 / 订阅）', 'Auto-Recurring Monthly Rules')}
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
                        {newRecKind === 'income' ? t('固定收入', 'Income') : t('固定支出', 'Expense')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        setNewRecOwner((prev) => (prev === 'me' ? 'partner' : prev === 'partner' ? 'shared' : 'me'))
                      }
                      style={[styles.microBtn, { backgroundColor: pal.pillBg, borderColor: pal.border }]}
                    >
                      <Text variant="caption" style={{ color: pal.ink, fontSize: 10 }}>
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
                            {`${t(`每月 ${rule.dayOfMonth} 日`, `Day ${rule.dayOfMonth}`)} · ${ownerMeta.zh}`}
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

            {/* Account Wallet Balances with Editable Initial Balance (底仓) */}
            <View style={styles.walletSection}>
              <Text variant="caption" style={{ color: pal.muted, fontSize: 11, fontWeight: '600' }}>
                {t('账户资金结余（点卡片按账户筛选 · 点「底仓」修改初始余额）', 'Account Wallets (Tap to filter · Edit base balance)')}
              </Text>
              <View style={styles.walletGrid}>
                {accountBalances.map(({ account, initialBalanceCny, balanceCny, monthExpenseCny }) => {
                  const isFiltered = filterAcc === account.id;
                  const isEditingInit = editingAccountInitId === account.id;
                  return (
                    <View
                      key={account.id}
                      style={[
                        styles.walletCard,
                        {
                          backgroundColor: isFiltered ? `${account.color}18` : pal.cardElevated,
                          borderColor: isFiltered ? account.color : pal.border,
                        },
                      ]}
                    >
                      <View style={styles.metricHeaderRow}>
                        <Pressable onPress={() => setFilterAcc((prev) => (prev === account.id ? 'all' : account.id))}>
                          <Text variant="caption" style={{ color: pal.ink, fontWeight: '700', fontSize: 11 }}>
                            {t(account.zh, account.en)}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`修改 ${account.zh} 初始底仓余额`}
                          onPress={() => {
                            if (isEditingInit) {
                              setEditingAccountInitId(null);
                            } else {
                              setEditingAccountInitId(account.id);
                              setAccountInitDraft(String(initialBalanceCny));
                            }
                          }}
                        >
                          <Text variant="caption" style={{ color: pal.goldText, fontSize: 9.5, fontFamily: theme.fontFamily.mono }}>
                            {t(`底仓 ¥${initialBalanceCny} [改]`, `Base ¥${initialBalanceCny}`)}
                          </Text>
                        </Pressable>
                      </View>
                      {isEditingInit ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <TextInput
                            value={accountInitDraft}
                            onChangeText={setAccountInitDraft}
                            onSubmitEditing={() => {
                              const val = evaluateAmountExpression(accountInitDraft) ?? 0;
                              setState(updateAccountInitialBalance(account.id, val));
                              setEditingAccountInitId(null);
                              showToast({ text: t(`已更新 ${account.zh} 初始底仓为 ¥${val}`, `Updated ${account.en} base to ¥${val}`) });
                            }}
                            placeholder="0"
                            style={[styles.miniNameInput, { flex: 1, height: 24, backgroundColor: pal.inputBg, borderColor: pal.gold, color: pal.ink }]}
                          />
                          <Pressable
                            onPress={() => {
                              const val = evaluateAmountExpression(accountInitDraft) ?? 0;
                              setState(updateAccountInitialBalance(account.id, val));
                              setEditingAccountInitId(null);
                              showToast({ text: t(`已更新 ${account.zh} 初始底仓为 ¥${val}`, `Updated ${account.en} base to ¥${val}`) });
                            }}
                            style={[styles.microBtn, { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: pal.pillActiveBg, borderColor: pal.gold }]}
                          >
                            <Text variant="caption" style={{ color: pal.goldText, fontSize: 9.5, fontWeight: '700' }}>✓</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          onPress={() => setFilterAcc((prev) => (prev === account.id ? 'all' : account.id))}
                          style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}
                        >
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
                          <Text variant="caption" style={{ color: pal.muted, fontSize: 9.5, fontFamily: theme.fontFamily.mono }}>
                            {`${t('月支', 'Out')} -¥${monthExpenseCny.toFixed(0)}`}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Right Column: 14-Day Spend Bars + Category Breakdown + Daily Transaction Stream */}
          <View style={styles.rightPanelStack}>
            <View style={[styles.rightCard, { backgroundColor: pal.cardBg, borderColor: pal.border }]}>
              <View style={styles.sectionTitleRow}>
                <Text variant="label" style={{ color: pal.ink, fontSize: 13.5, fontWeight: '700' }}>
                  {t('本月支出结构与近 14 日消费趋势', 'Category Breakdown & 14-Day Spend Trend')}
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
                      {t('清除筛选', 'Clear Filter')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

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
                          {t(item.category.zh, item.category.en)}
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
                  {t('收支流水明细', 'Transaction Ledger')}
                </Text>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t('搜索备注或分类…', 'Search transactions…')}
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
                    {t('暂无匹配的收支记录，可在上方输入自然语言或点击分类入账。', 'No matching transactions yet.')}
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
                        const bookMeta = getLedgerBookMeta(tx.ledgerId, ledgerBooks);
                        return (
                          <View key={tx.id} style={styles.txRow}>
                            <View style={styles.txLeft}>
                              <View
                                style={[
                                  styles.txIconBadge,
                                  { backgroundColor: `${cat.color}18`, borderColor: `${cat.color}55` },
                                ]}
                              >
                                <Text variant="caption" style={{ fontSize: 11, fontWeight: '700', color: cat.color }}>
                                  {cat.icon}
                                </Text>
                              </View>
                              <View style={{ gap: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                  <Text variant="caption" style={{ color: pal.ink, fontSize: 12, fontWeight: '600' }}>
                                    {tx.note}
                                  </Text>
                                  <View
                                    style={[
                                      styles.ownerMiniTag,
                                      { backgroundColor: `${ownerMeta.color}18`, borderColor: `${ownerMeta.color}55` },
                                    ]}
                                  >
                                    <Text variant="caption" style={{ color: ownerMeta.color, fontSize: 9, fontWeight: '700' }}>
                                      {ownerMeta.zh}
                                    </Text>
                                  </View>
                                  <View
                                    style={[
                                      styles.ownerMiniTag,
                                      { backgroundColor: `${bookMeta.color}16`, borderColor: `${bookMeta.color}55` },
                                    ]}
                                  >
                                    <Text variant="caption" style={{ color: bookMeta.color, fontSize: 9, fontWeight: '700' }}>
                                      {t(bookMeta.zh, bookMeta.en)}
                                    </Text>
                                  </View>
                                </View>
                                <Text variant="caption" style={{ color: pal.muted, fontSize: 10 }}>
                                  {`${t(cat.zh, cat.en)} · ${t(acc.zh, acc.en)}`}
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
                                accessibilityLabel={`对账单 ${tx.note} 发送双人聊天留言`}
                                onPress={() => {
                                  setQuotedTxForChat({
                                    txId: tx.id,
                                    note: tx.note,
                                    amountCny: tx.amountCny,
                                    kind: tx.kind,
                                    ledgerTitle: bookMeta.zh,
                                  });
                                  setShowCoupleChatDrawer(true);
                                }}
                                style={[styles.microBtn, { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: pal.pillBg, borderColor: pal.border }]}
                              >
                                <Text variant="caption" style={{ color: pal.sub, fontSize: 9.5 }}>
                                  {t('留言', 'Chat')}
                                </Text>
                              </Pressable>
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
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
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
    paddingVertical: 3.5,
    borderRadius: 6,
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
    borderRadius: 6,
    borderWidth: 1,
  },
  wealthCardWrap: {
    marginHorizontal: 14,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 11,
  },
  slidersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  sliderCard: {
    flex: 1,
    minWidth: 220,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    gap: 5,
  },
  sliderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  sliderControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sliderStepBtn: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderTrackContainer: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderVisualTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  sliderVisualFill: {
    height: '100%',
    borderRadius: 999,
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
    gap: 4,
  },
  monogramCircle: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: 26,
    height: 26,
    borderRadius: 6,
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
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: 1,
  },
});
