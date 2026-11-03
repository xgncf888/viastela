/**
 * Core domain model, natural-language parser, iOS Shortcuts URL auto-logger,
 * recurring rules engine, Salary × Investment Ratio -> Target Wealth Compounding
 * Trajectory calculator, Multi-Ledger & Pooled Funds aggregation engine,
 * and Couple Co-Op Friend Pairing + In-App Chat engine.
 */

import { addDaysToLocalDay } from './life-milestones-okr';

export type LedgerEntryKind = 'expense' | 'income';

export type LedgerOwnerId = 'me' | 'partner' | 'shared';

export type LedgerCategoryId =
  | 'dining'
  | 'coffee'
  | 'transit'
  | 'shopping'
  | 'housing'
  | 'entertainment'
  | 'fitness'
  | 'study'
  | 'digital'
  | 'salary'
  | 'investment'
  | 'bonus';

export type LedgerAccountId = 'alipay' | 'wechat' | 'bank' | 'applepay';

/** Multi-ledger ID (e.g. 'ledger-daily', 'ledger-travel', 'ledger-invest', or custom) */
export type LedgerBookId = string;

/** Scope selector: 'pool' aggregates all ledgers with includeInPool === true, or a specific ledger ID */
export type LedgerScopeId = 'pool' | LedgerBookId;

export type LedgerBook = {
  id: LedgerBookId;
  /** Clean 1-char typographic monogram (e.g. '家', '旅', '投', '专') */
  icon: string;
  zh: string;
  en: string;
  monthlyBudgetCny: number;
  /** Whether this ledger's cashflow & budget are pooled into the unified family fund pool (资金合池统计) */
  includeInPool: boolean;
  color: string;
};

export type LedgerPoolBreakdownItem = {
  book: LedgerBook;
  monthExpenseCny: number;
  monthIncomeCny: number;
  netCashflowCny: number;
  totalHistoricalNetCny: number;
  budgetUsedPct: number;
  poolExpenseSharePct: number;
  txCount: number;
};

export type LedgerCategoryMeta = {
  id: LedgerCategoryId;
  kind: LedgerEntryKind;
  /** Clean 1-char typographic monogram instead of cartoon emoji */
  icon: string;
  zh: string;
  en: string;
  color: string;
  keywords: readonly string[];
};

export type LedgerAccountMeta = {
  id: LedgerAccountId;
  /** Clean 1-char typographic monogram */
  icon: string;
  zh: string;
  en: string;
  color: string;
  initialBalanceCny: number;
  keywords: readonly string[];
};

export type LedgerTransaction = {
  id: string;
  kind: LedgerEntryKind;
  amountCny: number;
  categoryId: LedgerCategoryId;
  accountId: LedgerAccountId;
  note: string;
  localDay: string;
  createdAt: string;
  owner?: LedgerOwnerId;
  /** Which ledger book this transaction belongs to (defaults to 'ledger-daily') */
  ledgerId?: LedgerBookId;
  recurringRuleId?: string;
};

export type RecurringLedgerRule = {
  id: string;
  title: string;
  kind: LedgerEntryKind;
  amountCny: number;
  categoryId: LedgerCategoryId;
  accountId: LedgerAccountId;
  /** Day of month (1..28) when this recurring item triggers automatically */
  dayOfMonth: number;
  owner: LedgerOwnerId;
  ledgerId?: LedgerBookId;
  enabled: boolean;
  lastAppliedYearMonth?: string | null;
};

export type WealthPlanConfig = {
  /** Starting liquid net worth / savings pool (CNY) */
  currentSavedCny: number;
  /** Target wealth milestone (CNY), e.g. 1,500,000 */
  targetWealthCny: number;
  /** Percentage of monthly income invested each month (5..90) */
  investRatePct: number;
  /** Expected annualized compound return percentage (0..20, supports 0.5 steps) */
  annualReturnPct: number;
};

export type CoupleTeamProfile = {
  coupleMode: boolean;
  myName: string;
  partnerName: string;
  jointWishTitle: string;
  teamStreakDays: number;
  /** Unique friend code for in-app friend adding */
  myFriendCode: string;
  /** Bound partner friend code */
  partnerFriendCode: string;
  /** Shared 6-char real-time room code for live ledger & chat sync */
  roomCode: string;
  /** Whether a partner friend is actively bound */
  friendBound: boolean;
  /** Whether new bills & chat messages auto-sync in real time */
  autoSyncEnabled: boolean;
};

export type CoupleChatMessage = {
  id: string;
  sender: 'me' | 'partner' | 'system';
  senderName: string;
  text: string;
  createdAt: string;
  linkedTx?: {
    txId: string;
    note: string;
    amountCny: number;
    kind: LedgerEntryKind;
    ledgerTitle?: string;
  };
};

export type QuickLedgerPreset = {
  id: string;
  icon: string;
  zh: string;
  en: string;
  /** Fixed price (when isFixedPrice is true) or default suggested reference price */
  amountCny: number;
  /** If true, clicking logs immediately with amountCny; if false, clicking opens quick amount input */
  isFixedPrice?: boolean;
  categoryId: LedgerCategoryId;
  accountId: LedgerAccountId;
  owner?: LedgerOwnerId;
  ledgerId?: LedgerBookId;
};

export type BookkeepingState = {
  monthlyBudgetCny: number;
  currencySymbol: string;
  transactions: LedgerTransaction[];
  recurringRules: RecurringLedgerRule[];
  wealthPlan: WealthPlanConfig;
  coupleProfile: CoupleTeamProfile;
  quickPresets?: QuickLedgerPreset[];
  ledgerBooks?: LedgerBook[];
  chatMessages?: CoupleChatMessage[];
};

export type MonthlyBookkeepingSummary = {
  yearMonth: string;
  monthlyBudgetCny: number;
  totalExpenseCny: number;
  totalIncomeCny: number;
  netCashflowCny: number;
  todayExpenseCny: number;
  todayIncomeCny: number;
  budgetUsedPct: number;
  remainingBudgetCny: number;
  daysLeftInMonth: number;
  dailySafeToSpendCny: number;
  isOverBudget: boolean;
  pooledLedgerCount: number;
  byOwner: {
    meExpenseCny: number;
    partnerExpenseCny: number;
    sharedExpenseCny: number;
    meIncomeCny: number;
    partnerIncomeCny: number;
  };
};

export type CategoryBreakdownItem = {
  category: LedgerCategoryMeta;
  amountCny: number;
  count: number;
  sharePct: number;
};

export type DailySpendBarItem = {
  localDay: string;
  shortLabel: string;
  expenseCny: number;
  incomeCny: number;
  heightPct: number;
  isToday: boolean;
};

export type WealthCurvePoint = {
  monthOffset: number;
  yearMonth: string;
  label: string;
  principalCny: number;
  compoundWealthCny: number;
  gainCny: number;
};

export type WealthGoalTrajectory = {
  currentSavedCny: number;
  targetWealthCny: number;
  monthlyIncomeCny: number;
  investRatePct: number;
  monthlyInvestCny: number;
  annualReturnPct: number;
  monthsToGoal: number;
  yearsPart: number;
  monthsPart: number;
  estimatedGoalYearMonth: string;
  alreadyReached: boolean;
  points: WealthCurvePoint[];
  milestones: {
    horizonLabel: string;
    principalCny: number;
    compoundWealthCny: number;
    gainCny: number;
  }[];
};

export const DEFAULT_LEDGER_BOOKS: readonly LedgerBook[] = [
  {
    id: 'ledger-daily',
    icon: '家',
    zh: '日常家庭账本',
    en: 'Household Daily',
    monthlyBudgetCny: 6000,
    includeInPool: true,
    color: '#f5b942',
  },
  {
    id: 'ledger-travel',
    icon: '旅',
    zh: '旅行心愿专账',
    en: 'Travel & Wish',
    monthlyBudgetCny: 3000,
    includeInPool: true,
    color: '#38bdf8',
  },
  {
    id: 'ledger-invest',
    icon: '投',
    zh: '长期定投专账',
    en: 'Wealth & Invest',
    monthlyBudgetCny: 2000,
    includeInPool: true,
    color: '#34d399',
  },
];

export const LEDGER_CATEGORIES: readonly LedgerCategoryMeta[] = [
  {
    id: 'dining',
    kind: 'expense',
    icon: '餐',
    zh: '餐饮美食',
    en: 'Dining',
    color: '#f59e0b',
    keywords: ['饭', '餐', '面', '火锅', '烧烤', '外卖', '美团', '饿了么', '早饭', '午饭', '晚饭', '夜宵', 'lunch', 'dinner', 'food', 'meal'],
  },
  {
    id: 'coffee',
    kind: 'expense',
    icon: '饮',
    zh: '咖啡茶饮',
    en: 'Coffee & Tea',
    color: '#d97706',
    keywords: ['咖啡', '瑞幸', '星巴克', '奶茶', '喜茶', '霸王茶姬', '拿铁', '美式', '下午茶', 'coffee', 'latte', 'tea', 'boba'],
  },
  {
    id: 'transit',
    kind: 'expense',
    icon: '行',
    zh: '交通出行',
    en: 'Transit',
    color: '#38bdf8',
    keywords: ['地铁', '打车', '滴滴', '公交', '高铁', '机票', '加油', '停车', '过路费', 'uber', 'grab', 'taxi', 'mrt', 'bus'],
  },
  {
    id: 'shopping',
    kind: 'expense',
    icon: '购',
    zh: '日用百货',
    en: 'Shopping',
    color: '#ec4899',
    keywords: ['超市', '盒马', '山姆', '淘宝', '京东', '拼多多', '日用', '衣服', '纸巾', '水果', '买菜', '护肤', '化妆品', 'grocery', 'shop', 'amazon'],
  },
  {
    id: 'housing',
    kind: 'expense',
    icon: '居',
    zh: '居住房贷',
    en: 'Housing & Bills',
    color: '#8b5cf6',
    keywords: ['房租', '房贷', '按揭', '水电', '燃气', '物业', '宽带', '话费', '手机费', 'rent', 'mortgage', 'utility', 'wifi', 'bill'],
  },
  {
    id: 'entertainment',
    kind: 'expense',
    icon: '娱',
    zh: '娱乐订阅',
    en: 'Fun & Subs',
    color: '#a855f7',
    keywords: ['电影', '会员', '订阅', '游戏', '演出', '展览', '旅行', '酒店', '约会', 'netflix', 'spotify', 'icloud', 'movie', 'game'],
  },
  {
    id: 'fitness',
    kind: 'expense',
    icon: '健',
    zh: '运动健康',
    en: 'Health & Gym',
    color: '#10b981',
    keywords: ['健身', '蛋白粉', '私教', '游泳', '羽毛球', '瑜伽', '普拉提', '体检', '买药', '医院', '补剂', 'gym', 'protein', 'health'],
  },
  {
    id: 'study',
    kind: 'expense',
    icon: '学',
    zh: '书籍课程',
    en: 'Books & Study',
    color: '#eab308',
    keywords: ['买书', '书籍', '课程', '培训', '考试', '极客时间', 'claude', 'openai', 'cursor', 'book', 'course'],
  },
  {
    id: 'digital',
    kind: 'expense',
    icon: '数',
    zh: '数码装备',
    en: 'Tech & Gear',
    color: '#06b6d4',
    keywords: ['键盘', '鼠标', '显示器', '镜头', '手机', '充电器', '耳机', 'mac', 'iphone', 'gear'],
  },
  {
    id: 'salary',
    kind: 'income',
    icon: '薪',
    zh: '薪资收入',
    en: 'Salary',
    color: '#34d399',
    keywords: ['工资', '薪水', '月薪', '发薪', '稿费', 'salary', 'paycheck', 'wage'],
  },
  {
    id: 'investment',
    kind: 'income',
    icon: '理',
    zh: '理财分红',
    en: 'Investment',
    color: '#10b981',
    keywords: ['分红', '利息', '股票', '基金', '定投收益', '理财', 'dividend', 'interest', 'yield'],
  },
  {
    id: 'bonus',
    kind: 'income',
    icon: '奖',
    zh: '奖金副业',
    en: 'Bonus & Side',
    color: '#f5b942',
    keywords: ['奖金', '红包', '报销', '兼职', '副业', '闲鱼', '退款', 'bonus', 'refund', 'side'],
  },
];

export const LEDGER_ACCOUNTS: readonly LedgerAccountMeta[] = [
  {
    id: 'alipay',
    icon: '支',
    zh: '支付宝',
    en: 'Alipay',
    color: '#38bdf8',
    initialBalanceCny: 6800,
    keywords: ['支付宝', '花呗', 'alipay'],
  },
  {
    id: 'wechat',
    icon: '微',
    zh: '微信支付',
    en: 'WeChat Pay',
    color: '#34d399',
    initialBalanceCny: 4200,
    keywords: ['微信', '零钱', 'wechat', 'wx'],
  },
  {
    id: 'bank',
    icon: '招',
    zh: '招商银行卡',
    en: 'Bank Card',
    color: '#f5b942',
    initialBalanceCny: 36500,
    keywords: ['招行', '银行卡', '工资卡', '信用卡', 'bank', 'card', 'cmb'],
  },
  {
    id: 'applepay',
    icon: '卡',
    zh: 'Apple Pay',
    en: 'Apple Pay',
    color: '#f472b6',
    initialBalanceCny: 2500,
    keywords: ['apple', '现金', '八达通', 'cash'],
  },
];

export const QUICK_LEDGER_PRESETS: readonly QuickLedgerPreset[] = [
  {
    id: 'preset-transit',
    icon: '行',
    zh: '地铁通勤',
    en: 'Subway',
    amountCny: 3,
    isFixedPrice: true,
    categoryId: 'transit',
    accountId: 'applepay',
    owner: 'me',
    ledgerId: 'ledger-daily',
  },
  {
    id: 'preset-coffee',
    icon: '饮',
    zh: '冰美式/拿铁',
    en: 'Iced Latte',
    amountCny: 18,
    isFixedPrice: false,
    categoryId: 'coffee',
    accountId: 'wechat',
    owner: 'me',
    ledgerId: 'ledger-daily',
  },
  {
    id: 'preset-lunch',
    icon: '餐',
    zh: '工作午餐',
    en: 'Work Lunch',
    amountCny: 36,
    isFixedPrice: false,
    categoryId: 'dining',
    accountId: 'alipay',
    owner: 'me',
    ledgerId: 'ledger-daily',
  },
  {
    id: 'preset-boba',
    icon: '饮',
    zh: '伴侣茶饮甜品',
    en: 'Partner Tea',
    amountCny: 22,
    isFixedPrice: false,
    categoryId: 'coffee',
    accountId: 'wechat',
    owner: 'partner',
    ledgerId: 'ledger-daily',
  },
  {
    id: 'preset-grocery',
    icon: '购',
    zh: '家庭生鲜采购',
    en: 'Groceries',
    amountCny: 128,
    isFixedPrice: false,
    categoryId: 'shopping',
    accountId: 'alipay',
    owner: 'shared',
    ledgerId: 'ledger-daily',
  },
  {
    id: 'preset-date',
    icon: '餐',
    zh: '周末双人晚餐',
    en: 'Couple Dinner',
    amountCny: 268,
    isFixedPrice: false,
    categoryId: 'dining',
    accountId: 'bank',
    owner: 'shared',
    ledgerId: 'ledger-travel',
  },
];

export const DEFAULT_RECURRING_RULES: readonly RecurringLedgerRule[] = [
  {
    id: 'rec-my-salary',
    title: '本人固定月薪入账',
    kind: 'income',
    amountCny: 26800,
    categoryId: 'salary',
    accountId: 'bank',
    dayOfMonth: 1,
    owner: 'me',
    ledgerId: 'ledger-daily',
    enabled: true,
    lastAppliedYearMonth: '2026-11',
  },
  {
    id: 'rec-partner-salary',
    title: '老婆固定月薪入账',
    kind: 'income',
    amountCny: 22000,
    categoryId: 'salary',
    accountId: 'bank',
    dayOfMonth: 1,
    owner: 'partner',
    ledgerId: 'ledger-daily',
    enabled: true,
    lastAppliedYearMonth: '2026-11',
  },
  {
    id: 'rec-housing-mortgage',
    title: '家庭房贷/房租固定扣款',
    kind: 'expense',
    amountCny: 5500,
    categoryId: 'housing',
    accountId: 'bank',
    dayOfMonth: 5,
    owner: 'shared',
    ledgerId: 'ledger-daily',
    enabled: true,
    lastAppliedYearMonth: null,
  },
  {
    id: 'rec-cloud-subs',
    title: '家庭云存储与数字订阅',
    kind: 'expense',
    amountCny: 88,
    categoryId: 'entertainment',
    accountId: 'applepay',
    dayOfMonth: 15,
    owner: 'shared',
    ledgerId: 'ledger-daily',
    enabled: true,
    lastAppliedYearMonth: null,
  },
];

export const DEFAULT_WEALTH_PLAN: WealthPlanConfig = {
  currentSavedCny: 360000,
  targetWealthCny: 1500000,
  investRatePct: 45,
  annualReturnPct: 8,
};

export const DEFAULT_COUPLE_PROFILE: CoupleTeamProfile = {
  coupleMode: true,
  myName: '我',
  partnerName: '老婆',
  jointWishTitle: '家庭共同旅行基金',
  teamStreakDays: 12,
  myFriendCode: 'VS-8829',
  partnerFriendCode: 'VS-6612',
  roomCode: 'LOVE-88',
  friendBound: true,
  autoSyncEnabled: true,
};

export const DEFAULT_COUPLE_CHAT_MESSAGES: readonly CoupleChatMessage[] = [
  {
    id: 'chat-seed-1',
    sender: 'partner',
    senderName: '老婆',
    text: '盒马买的牛排和蓝莓我已经记在「日常家庭账本」啦，周末纪念日晚餐我们可以记到「旅行心愿专账」里。',
    createdAt: '2026-11-01T18:25:00.000Z',
    linkedTx: {
      txId: 'tx-seed-2',
      note: '盒马生鲜牛排与蓝莓双人采购',
      amountCny: 168,
      kind: 'expense',
      ledgerTitle: '日常家庭账本',
    },
  },
  {
    id: 'chat-seed-2',
    sender: 'me',
    senderName: '我',
    text: '收到，这个月我们把定投比例调到 45%，三个账本资金合池统计下来结余很稳。',
    createdAt: '2026-11-02T20:10:00.000Z',
  },
];

export const DEFAULT_BOOKKEEPING_STATE: BookkeepingState = {
  monthlyBudgetCny: 6000,
  currencySymbol: '¥',
  recurringRules: [...DEFAULT_RECURRING_RULES],
  wealthPlan: { ...DEFAULT_WEALTH_PLAN },
  coupleProfile: { ...DEFAULT_COUPLE_PROFILE },
  quickPresets: [...QUICK_LEDGER_PRESETS],
  ledgerBooks: [...DEFAULT_LEDGER_BOOKS],
  chatMessages: [...DEFAULT_COUPLE_CHAT_MESSAGES],
  transactions: [
    {
      id: 'tx-seed-1',
      kind: 'income',
      amountCny: 26800,
      categoryId: 'salary',
      accountId: 'bank',
      note: '本月薪资与绩效入账',
      localDay: '2026-11-01',
      createdAt: '2026-11-01T09:30:00.000Z',
      owner: 'me',
      ledgerId: 'ledger-daily',
      recurringRuleId: 'rec-my-salary',
    },
    {
      id: 'tx-seed-1b',
      kind: 'income',
      amountCny: 22000,
      categoryId: 'salary',
      accountId: 'bank',
      note: '老婆本月薪资入账',
      localDay: '2026-11-01',
      createdAt: '2026-11-01T09:35:00.000Z',
      owner: 'partner',
      ledgerId: 'ledger-daily',
      recurringRuleId: 'rec-partner-salary',
    },
    {
      id: 'tx-seed-2',
      kind: 'expense',
      amountCny: 168,
      categoryId: 'shopping',
      accountId: 'alipay',
      note: '盒马生鲜牛排与蓝莓双人采购',
      localDay: '2026-11-01',
      createdAt: '2026-11-01T18:20:00.000Z',
      owner: 'shared',
      ledgerId: 'ledger-daily',
    },
    {
      id: 'tx-seed-3',
      kind: 'expense',
      amountCny: 68,
      categoryId: 'study',
      accountId: 'alipay',
      note: '技术原版电子书与论文订阅',
      localDay: '2026-11-02',
      createdAt: '2026-11-02T11:10:00.000Z',
      owner: 'me',
      ledgerId: 'ledger-invest',
    },
    {
      id: 'tx-seed-4',
      kind: 'expense',
      amountCny: 45,
      categoryId: 'dining',
      accountId: 'wechat',
      note: '午餐轻食波奇饭',
      localDay: '2026-11-02',
      createdAt: '2026-11-02T12:40:00.000Z',
      owner: 'partner',
      ledgerId: 'ledger-daily',
    },
    {
      id: 'tx-seed-5',
      kind: 'expense',
      amountCny: 18,
      categoryId: 'coffee',
      accountId: 'wechat',
      note: '手冲冰美式',
      localDay: '2026-11-03',
      createdAt: '2026-11-03T09:15:00.000Z',
      owner: 'me',
      ledgerId: 'ledger-daily',
    },
    {
      id: 'tx-seed-6',
      kind: 'expense',
      amountCny: 38,
      categoryId: 'dining',
      accountId: 'alipay',
      note: '商务简餐定食',
      localDay: '2026-11-03',
      createdAt: '2026-11-03T12:30:00.000Z',
      owner: 'me',
      ledgerId: 'ledger-travel',
    },
  ],
};

export function getLedgerBookMeta(
  ledgerId: LedgerBookId | undefined,
  books: readonly LedgerBook[] = DEFAULT_LEDGER_BOOKS,
): LedgerBook {
  const id = ledgerId || 'ledger-daily';
  return books.find((b) => b.id === id) ?? books[0] ?? DEFAULT_LEDGER_BOOKS[0]!;
}

/**
 * Filters transactions according to the active ledger scope:
 * - `'pool'`: includes transactions from all ledgers where `includeInPool === true`
 * - `<ledgerId>`: includes only transactions belonging to that specific ledger
 */
export function filterTransactionsByLedgerScope(
  transactions: readonly LedgerTransaction[],
  books: readonly LedgerBook[],
  scope: LedgerScopeId,
): LedgerTransaction[] {
  if (scope === 'pool') {
    const pooledIds = new Set(books.filter((b) => b.includeInPool).map((b) => b.id));
    // Always keep at least 'ledger-daily' if all were unchecked
    if (pooledIds.size === 0 && books[0]) {
      pooledIds.add(books[0].id);
    }
    return transactions.filter((tx) => pooledIds.has(tx.ledgerId ?? 'ledger-daily'));
  }
  return transactions.filter((tx) => (tx.ledgerId ?? 'ledger-daily') === scope);
}

/**
 * Computes per-ledger cashflow, budget utilization, and share of the family fund pool.
 */
export function computeMultiLedgerPoolBreakdown(
  state: BookkeepingState,
  yearMonth: string,
): {
  items: LedgerPoolBreakdownItem[];
  pooledMonthlyBudgetCny: number;
  pooledMonthExpenseCny: number;
  pooledMonthIncomeCny: number;
  pooledNetCashflowCny: number;
} {
  const books = state.ledgerBooks && state.ledgerBooks.length > 0 ? state.ledgerBooks : DEFAULT_LEDGER_BOOKS;
  let pooledMonthlyBudgetCny = 0;
  let pooledMonthExpenseCny = 0;
  let pooledMonthIncomeCny = 0;

  const rawStats = books.map((book) => {
    let monthExp = 0;
    let monthInc = 0;
    let histNet = 0;
    let count = 0;
    for (const tx of state.transactions) {
      const txLedger = tx.ledgerId ?? 'ledger-daily';
      if (txLedger !== book.id) continue;
      count += 1;
      if (tx.kind === 'expense') histNet -= tx.amountCny;
      else histNet += tx.amountCny;

      if (tx.localDay.startsWith(yearMonth)) {
        if (tx.kind === 'expense') monthExp += tx.amountCny;
        else monthInc += tx.amountCny;
      }
    }
    monthExp = Math.round(monthExp * 100) / 100;
    monthInc = Math.round(monthInc * 100) / 100;
    histNet = Math.round(histNet * 100) / 100;

    if (book.includeInPool) {
      pooledMonthlyBudgetCny += book.monthlyBudgetCny;
      pooledMonthExpenseCny += monthExp;
      pooledMonthIncomeCny += monthInc;
    }

    return {
      book,
      monthExpenseCny: monthExp,
      monthIncomeCny: monthInc,
      netCashflowCny: Math.round((monthInc - monthExp) * 100) / 100,
      totalHistoricalNetCny: histNet,
      budgetUsedPct:
        book.monthlyBudgetCny > 0 ? Math.min(999, Math.round((monthExp / book.monthlyBudgetCny) * 100)) : 0,
      txCount: count,
    };
  });

  pooledMonthExpenseCny = Math.round(pooledMonthExpenseCny * 100) / 100;
  pooledMonthIncomeCny = Math.round(pooledMonthIncomeCny * 100) / 100;

  const items: LedgerPoolBreakdownItem[] = rawStats.map((s) => ({
    ...s,
    poolExpenseSharePct:
      s.book.includeInPool && pooledMonthExpenseCny > 0
        ? Math.max(1, Math.round((s.monthExpenseCny / pooledMonthExpenseCny) * 100))
        : 0,
  }));

  return {
    items,
    pooledMonthlyBudgetCny: Math.max(100, pooledMonthlyBudgetCny || state.monthlyBudgetCny || 6000),
    pooledMonthExpenseCny,
    pooledMonthIncomeCny,
    pooledNetCashflowCny: Math.round((pooledMonthIncomeCny - pooledMonthExpenseCny) * 100) / 100,
  };
}

export function getLedgerCategoryMeta(id: LedgerCategoryId): LedgerCategoryMeta {
  return LEDGER_CATEGORIES.find((c) => c.id === id) ?? LEDGER_CATEGORIES[0]!;
}

export function getLedgerAccountMeta(id: LedgerAccountId): LedgerAccountMeta {
  return LEDGER_ACCOUNTS.find((a) => a.id === id) ?? LEDGER_ACCOUNTS[0]!;
}

export function getOwnerBadgeMeta(
  owner: LedgerOwnerId = 'me',
  profile: CoupleTeamProfile = DEFAULT_COUPLE_PROFILE,
): { icon: string; zh: string; en: string; color: string } {
  if (owner === 'partner') {
    return { icon: '伴', zh: profile.partnerName || '老婆', en: 'Partner', color: '#f472b6' };
  }
  if (owner === 'shared') {
    return { icon: '共', zh: '共同', en: 'Joint', color: '#f5b942' };
  }
  return { icon: '我', zh: profile.myName || '我', en: 'Me', color: '#38bdf8' };
}

/**
 * Evaluates simple additive/subtractive math expressions like `"35+18"` or `"120-25"`
 * or plain numbers `"42.5"`.
 */
export function evaluateAmountExpression(raw: string): number | null {
  const cleaned = raw.replace(/[¥$,，\s]/g, '');
  if (!cleaned) return null;
  if (!/^[+-]?\d+(\.\d+)?([+-]\d+(\.\d+)?)*$/.test(cleaned)) {
    const numMatch = raw.match(/([+-]?\d+(?:\.\d+)?)/);
    if (!numMatch) return null;
    const val = Number.parseFloat(numMatch[1]!);
    return Number.isFinite(val) && Math.abs(val) > 0 ? Math.round(Math.abs(val) * 100) / 100 : null;
  }
  const tokens = cleaned.match(/[+-]?\d+(\.\d+)?/g);
  if (!tokens) return null;
  const total = tokens.reduce((sum, token) => sum + Number.parseFloat(token), 0);
  const absTotal = Math.round(Math.abs(total) * 100) / 100;
  return Number.isFinite(absTotal) && absTotal > 0 ? absTotal : null;
}

export function parseQuickBookkeepingInput(
  rawText: string,
  fallbackCategoryId: LedgerCategoryId = 'dining',
  fallbackAccountId: LedgerAccountId = 'wechat',
  fallbackOwner: LedgerOwnerId = 'me',
): {
  kind: LedgerEntryKind;
  amountCny: number;
  categoryId: LedgerCategoryId;
  accountId: LedgerAccountId;
  owner: LedgerOwnerId;
  note: string;
} | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  const mathMatch = trimmed.match(/([+-]?\d+(?:\.\d+)?(?:\s*[+-]\s*\d+(?:\.\d+)?)*)/);
  if (!mathMatch) return null;

  const rawNumberToken = mathMatch[1]!;
  const amountCny = evaluateAmountExpression(rawNumberToken);
  if (!amountCny || amountCny <= 0) return null;

  const lower = trimmed.toLowerCase();
  const hasPlusPrefix = rawNumberToken.trim().startsWith('+') || trimmed.includes('收入') || trimmed.includes('入账');

  let detectedOwner: LedgerOwnerId = fallbackOwner;
  if (/老婆|媳妇|太太|她|wife|partner/i.test(trimmed)) {
    detectedOwner = 'partner';
  } else if (/双人|共同|家庭|我们|一起|两人|joint|shared/i.test(trimmed)) {
    detectedOwner = 'shared';
  }

  let detectedAccount: LedgerAccountId = fallbackAccountId;
  for (const acc of LEDGER_ACCOUNTS) {
    if (acc.keywords.some((kw) => lower.includes(kw))) {
      detectedAccount = acc.id;
      break;
    }
  }

  let detectedCategory: LedgerCategoryMeta | null = null;
  for (const cat of LEDGER_CATEGORIES) {
    if (cat.keywords.some((kw) => lower.includes(kw))) {
      detectedCategory = cat;
      break;
    }
  }

  let kind: LedgerEntryKind = hasPlusPrefix ? 'income' : 'expense';
  let categoryId: LedgerCategoryId = fallbackCategoryId;

  if (detectedCategory) {
    categoryId = detectedCategory.id;
    kind = hasPlusPrefix ? 'income' : detectedCategory.kind;
  } else if (hasPlusPrefix) {
    categoryId = 'bonus';
    kind = 'income';
  }

  let cleanNote = trimmed.replace(rawNumberToken, '').replace(/[¥$元块]/g, '').trim();
  for (const acc of LEDGER_ACCOUNTS) {
    for (const kw of acc.keywords) {
      if (cleanNote.toLowerCase().endsWith(` ${kw}`) || cleanNote.toLowerCase() === kw) {
        cleanNote = cleanNote.slice(0, cleanNote.length - kw.length).trim();
      }
    }
  }
  const catMeta = getLedgerCategoryMeta(categoryId);
  if (!cleanNote) {
    cleanNote = catMeta.zh;
  }

  return {
    kind,
    amountCny,
    categoryId,
    accountId: detectedAccount,
    owner: detectedOwner,
    note: cleanNote,
  };
}

export function parseAutoLogUrlParams(search: string): {
  kind: LedgerEntryKind;
  amountCny: number;
  categoryId: LedgerCategoryId;
  accountId: LedgerAccountId;
  owner: LedgerOwnerId;
  note: string;
} | null {
  if (!search || !search.includes('=')) return null;
  try {
    const q = search.startsWith('?') ? search.slice(1) : search;
    const params = new URLSearchParams(q);
    const autoLogText = params.get('autoLog') ?? params.get('quickLog') ?? params.get('q');
    if (autoLogText && autoLogText.trim()) {
      return parseQuickBookkeepingInput(autoLogText.trim());
    }
    const rawAmount = params.get('amount') ?? params.get('amt');
    if (!rawAmount) return null;
    const merchant = params.get('merchant') ?? params.get('note') ?? params.get('title') ?? '快捷指令记账';
    const accountParam = params.get('account') ?? '';
    const ownerParam = params.get('owner') ?? '';
    const fallbackOwner: LedgerOwnerId =
      ownerParam === 'partner' || ownerParam === 'wife'
        ? 'partner'
        : ownerParam === 'shared' || ownerParam === 'joint'
          ? 'shared'
          : 'me';
    return parseQuickBookkeepingInput(
      `${merchant} ${rawAmount} ${accountParam}`.trim(),
      'dining',
      'wechat',
      fallbackOwner,
    );
  } catch {
    return null;
  }
}

export function materializeDueRecurringRules(
  state: BookkeepingState,
  todayLocalDay: string,
): { state: BookkeepingState; materializedCount: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayLocalDay)) {
    return { state, materializedCount: 0 };
  }
  const yearMonth = todayLocalDay.slice(0, 7);
  const currentDay = Number.parseInt(todayLocalDay.slice(8, 10), 10) || 1;

  let materializedCount = 0;
  const newTransactions: LedgerTransaction[] = [];

  const nextRules = state.recurringRules.map((rule) => {
    if (!rule.enabled) return rule;
    if (rule.lastAppliedYearMonth === yearMonth) return rule;
    if (rule.dayOfMonth > currentDay) return rule;

    const alreadyInTx = state.transactions.some(
      (tx) => tx.recurringRuleId === rule.id && tx.localDay.startsWith(yearMonth),
    );
    if (alreadyInTx) {
      return { ...rule, lastAppliedYearMonth: yearMonth };
    }

    materializedCount += 1;
    const dayStr = String(Math.max(1, Math.min(28, rule.dayOfMonth))).padStart(2, '0');
    const ruleLocalDay = `${yearMonth}-${dayStr}`;
    newTransactions.push({
      id: `tx-rec-${rule.id}-${yearMonth}`,
      kind: rule.kind,
      amountCny: rule.amountCny,
      categoryId: rule.categoryId,
      accountId: rule.accountId,
      note: `[周期] ${rule.title}`,
      localDay: ruleLocalDay,
      createdAt: `${ruleLocalDay}T09:00:00.000Z`,
      owner: rule.owner,
      ledgerId: rule.ledgerId ?? 'ledger-daily',
      recurringRuleId: rule.id,
    });
    return {
      ...rule,
      lastAppliedYearMonth: yearMonth,
    };
  });

  if (materializedCount === 0) {
    return { state, materializedCount: 0 };
  }

  return {
    state: {
      ...state,
      recurringRules: nextRules,
      transactions: [...newTransactions, ...state.transactions],
    },
    materializedCount,
  };
}

export function computeWealthGoalTrajectory(input: {
  wealthPlan: WealthPlanConfig;
  recurringRules: readonly RecurringLedgerRule[];
  fallbackMonthlyIncomeCny?: number;
  currentYearMonth?: string;
}): WealthGoalTrajectory {
  const startYearMonth =
    input.currentYearMonth && /^\d{4}-\d{2}$/.test(input.currentYearMonth)
      ? input.currentYearMonth
      : '2026-11';
  const [startYStr, startMStr] = startYearMonth.split('-');
  const startY = Number.parseInt(startYStr ?? '2026', 10) || 2026;
  const startM = Number.parseInt(startMStr ?? '11', 10) || 11;

  const recurringIncomeSum = input.recurringRules
    .filter((r) => r.enabled && r.kind === 'income')
    .reduce((sum, r) => sum + r.amountCny, 0);

  const monthlyIncomeCny = Math.max(
    1000,
    recurringIncomeSum > 0 ? recurringIncomeSum : (input.fallbackMonthlyIncomeCny ?? 30000),
  );

  const currentSavedCny = Math.max(0, Math.round(input.wealthPlan.currentSavedCny));
  const targetWealthCny = Math.max(50000, Math.round(input.wealthPlan.targetWealthCny));
  const investRatePct = Math.max(5, Math.min(90, Math.round(input.wealthPlan.investRatePct)));
  const annualReturnPct = Math.max(0, Math.min(25, Math.round(input.wealthPlan.annualReturnPct * 10) / 10));

  const monthlyInvestCny = Math.round(monthlyIncomeCny * (investRatePct / 100));
  const monthlyRate = annualReturnPct / 100 / 12;

  function formatFutureYm(offsetMonths: number): string {
    const totalM = startY * 12 + (startM - 1) + offsetMonths;
    const y = Math.floor(totalM / 12);
    const m = (totalM % 12) + 1;
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  function simulateMonth(months: number): { principalCny: number; compoundWealthCny: number; gainCny: number } {
    let wealth = currentSavedCny;
    let principal = currentSavedCny;
    for (let m = 1; m <= months; m += 1) {
      wealth = wealth * (1 + monthlyRate) + monthlyInvestCny;
      principal += monthlyInvestCny;
    }
    const roundedWealth = Math.round(wealth);
    const roundedPrincipal = Math.round(principal);
    return {
      principalCny: roundedPrincipal,
      compoundWealthCny: roundedWealth,
      gainCny: Math.max(0, roundedWealth - roundedPrincipal),
    };
  }

  const alreadyReached = currentSavedCny >= targetWealthCny;
  let monthsToGoal = 0;
  let simWealth = currentSavedCny;
  while (simWealth < targetWealthCny && monthsToGoal < 600) {
    simWealth = simWealth * (1 + monthlyRate) + monthlyInvestCny;
    monthsToGoal += 1;
  }

  const yearsPart = Math.floor(monthsToGoal / 12);
  const monthsPart = monthsToGoal % 12;
  const estimatedGoalYearMonth = formatFutureYm(monthsToGoal);

  const chartHorizonMonths = Math.max(24, Math.min(240, Math.ceil(Math.max(monthsToGoal, 36) * 1.1)));
  const stepCount = 15;
  const points: WealthCurvePoint[] = [];

  for (let i = 0; i <= stepCount; i += 1) {
    const m = Math.round((chartHorizonMonths * i) / stepCount);
    const sim = simulateMonth(m);
    const ym = formatFutureYm(m);
    points.push({
      monthOffset: m,
      yearMonth: ym,
      label: m === 0 ? '现在' : m % 12 === 0 ? `${m / 12}年` : `${m}月`,
      principalCny: sim.principalCny,
      compoundWealthCny: sim.compoundWealthCny,
      gainCny: sim.gainCny,
    });
  }

  const milestones = [12, 36, 60, 120].map((m) => {
    const sim = simulateMonth(m);
    return {
      horizonLabel: `${m / 12} 年后 (${formatFutureYm(m)})`,
      principalCny: sim.principalCny,
      compoundWealthCny: sim.compoundWealthCny,
      gainCny: sim.gainCny,
    };
  });

  return {
    currentSavedCny,
    targetWealthCny,
    monthlyIncomeCny,
    investRatePct,
    monthlyInvestCny,
    annualReturnPct,
    monthsToGoal,
    yearsPart,
    monthsPart,
    estimatedGoalYearMonth,
    alreadyReached,
    points,
    milestones,
  };
}

export function mergePartnerBookkeepingState(
  local: BookkeepingState,
  incoming: Partial<BookkeepingState>,
): { merged: BookkeepingState; addedTxCount: number; addedChatCount: number } {
  const existingIds = new Set(local.transactions.map((t) => t.id));
  const incomingTx = Array.isArray(incoming.transactions) ? incoming.transactions : [];
  const newTx: LedgerTransaction[] = [];

  for (const tx of incomingTx) {
    if (!tx || typeof tx.id !== 'string' || existingIds.has(tx.id)) continue;
    existingIds.add(tx.id);
    newTx.push({
      ...tx,
      owner: tx.owner ?? 'partner',
      ledgerId: tx.ledgerId ?? 'ledger-daily',
    });
  }

  const combinedTx = [...newTx, ...local.transactions].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  // Also non-destructively merge chat messages and custom ledgers
  const localChats = local.chatMessages ?? [...DEFAULT_COUPLE_CHAT_MESSAGES];
  const existingChatIds = new Set(localChats.map((m) => m.id));
  const incomingChats = Array.isArray(incoming.chatMessages) ? incoming.chatMessages : [];
  const newChats: CoupleChatMessage[] = [];
  for (const msg of incomingChats) {
    if (!msg || typeof msg.id !== 'string' || existingChatIds.has(msg.id)) continue;
    existingChatIds.add(msg.id);
    newChats.push(msg);
  }
  const combinedChats = [...localChats, ...newChats].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );

  const localBooks = local.ledgerBooks ?? [...DEFAULT_LEDGER_BOOKS];
  const existingBookIds = new Set(localBooks.map((b) => b.id));
  const incomingBooks = Array.isArray(incoming.ledgerBooks) ? incoming.ledgerBooks : [];
  const mergedBooks = [...localBooks];
  for (const b of incomingBooks) {
    if (!b || typeof b.id !== 'string' || existingBookIds.has(b.id)) continue;
    existingBookIds.add(b.id);
    mergedBooks.push(b);
  }

  return {
    merged: {
      ...local,
      transactions: combinedTx,
      chatMessages: combinedChats,
      ledgerBooks: mergedBooks,
    },
    addedTxCount: newTx.length,
    addedChatCount: newChats.length,
  };
}

function daysInYearMonth(yearMonth: string): number {
  const [yStr, mStr] = yearMonth.split('-');
  const y = Number.parseInt(yStr ?? '2026', 10);
  const m = Number.parseInt(mStr ?? '11', 10);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return 30;
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function computeMonthlyBookkeepingSummary(
  state: BookkeepingState,
  todayLocalDay: string,
  scope: LedgerScopeId = 'pool',
): MonthlyBookkeepingSummary {
  const yearMonth = /^\d{4}-\d{2}/.test(todayLocalDay) ? todayLocalDay.slice(0, 7) : '2026-11';
  const dayOfMonth = /^\d{4}-\d{2}-\d{2}$/.test(todayLocalDay)
    ? Math.max(1, Number.parseInt(todayLocalDay.slice(8, 10), 10))
    : 1;
  const totalDays = daysInYearMonth(yearMonth);
  const daysLeftInMonth = Math.max(1, totalDays - dayOfMonth + 1);

  const books = state.ledgerBooks && state.ledgerBooks.length > 0 ? state.ledgerBooks : DEFAULT_LEDGER_BOOKS;
  const scopedTransactions =
     state.ledgerBooks && state.ledgerBooks.length > 0
      ? filterTransactionsByLedgerScope(state.transactions, books, scope)
      : state.transactions;

  let totalExpenseCny = 0;
  let totalIncomeCny = 0;
  let todayExpenseCny = 0;
  let todayIncomeCny = 0;
  let meExpenseCny = 0;
  let partnerExpenseCny = 0;
  let sharedExpenseCny = 0;
  let meIncomeCny = 0;
  let partnerIncomeCny = 0;

  for (const tx of scopedTransactions) {
    if (tx.localDay.startsWith(yearMonth)) {
      const owner = tx.owner ?? 'me';
      if (tx.kind === 'expense') {
        totalExpenseCny += tx.amountCny;
        if (owner === 'partner') partnerExpenseCny += tx.amountCny;
        else if (owner === 'shared') sharedExpenseCny += tx.amountCny;
        else meExpenseCny += tx.amountCny;
      } else {
        totalIncomeCny += tx.amountCny;
        if (owner === 'partner') partnerIncomeCny += tx.amountCny;
        else meIncomeCny += tx.amountCny;
      }
    }
    if (tx.localDay === todayLocalDay) {
      if (tx.kind === 'expense') {
        todayExpenseCny += tx.amountCny;
      } else {
        todayIncomeCny += tx.amountCny;
      }
    }
  }

  totalExpenseCny = Math.round(totalExpenseCny * 100) / 100;
  totalIncomeCny = Math.round(totalIncomeCny * 100) / 100;
  todayExpenseCny = Math.round(todayExpenseCny * 100) / 100;
  todayIncomeCny = Math.round(todayIncomeCny * 100) / 100;

  const activeBook = scope === 'pool' ? null : books.find((b) => b.id === scope);
  const monthlyBudgetCny = Math.max(
    100,
    activeBook ? activeBook.monthlyBudgetCny : state.monthlyBudgetCny || 6000,
  );
  const remainingBudgetCny = Math.round((monthlyBudgetCny - totalExpenseCny) * 100) / 100;
  const budgetUsedPct = Math.min(999, Math.round((totalExpenseCny / monthlyBudgetCny) * 100));
  const dailySafeToSpendCny = Math.max(0, Math.round(remainingBudgetCny / daysLeftInMonth));

  return {
    yearMonth,
    monthlyBudgetCny,
    totalExpenseCny,
    totalIncomeCny,
    netCashflowCny: Math.round((totalIncomeCny - totalExpenseCny) * 100) / 100,
    todayExpenseCny,
    todayIncomeCny,
    budgetUsedPct,
    remainingBudgetCny,
    daysLeftInMonth,
    dailySafeToSpendCny,
    isOverBudget: totalExpenseCny > monthlyBudgetCny,
    pooledLedgerCount: books.filter((b) => b.includeInPool).length,
    byOwner: {
      meExpenseCny: Math.round(meExpenseCny * 100) / 100,
      partnerExpenseCny: Math.round(partnerExpenseCny * 100) / 100,
      sharedExpenseCny: Math.round(sharedExpenseCny * 100) / 100,
      meIncomeCny: Math.round(meIncomeCny * 100) / 100,
      partnerIncomeCny: Math.round(partnerIncomeCny * 100) / 100,
    },
  };
}

export function computeCategoryBreakdown(
  transactions: readonly LedgerTransaction[],
  yearMonth: string,
  kind: LedgerEntryKind = 'expense',
): CategoryBreakdownItem[] {
  const byCat = new Map<LedgerCategoryId, { amount: number; count: number }>();
  let total = 0;

  for (const tx of transactions) {
    if (tx.kind !== kind || !tx.localDay.startsWith(yearMonth)) continue;
    const cur = byCat.get(tx.categoryId) ?? { amount: 0, count: 0 };
    cur.amount += tx.amountCny;
    cur.count += 1;
    byCat.set(tx.categoryId, cur);
    total += tx.amountCny;
  }

  if (total <= 0) return [];

  const items: CategoryBreakdownItem[] = [];
  for (const [catId, stat] of byCat.entries()) {
    const meta = getLedgerCategoryMeta(catId);
    items.push({
      category: meta,
      amountCny: Math.round(stat.amount * 100) / 100,
      count: stat.count,
      sharePct: Math.max(1, Math.round((stat.amount / total) * 100)),
    });
  }

  return items.sort((a, b) => b.amountCny - a.amountCny);
}

export function computeDailySpendBars(
  transactions: readonly LedgerTransaction[],
  endDay: string,
  windowDays = 14,
): DailySpendBarItem[] {
  const count = Math.max(7, Math.min(31, windowDays));
  const rawDays: { localDay: string; expenseCny: number; incomeCny: number }[] = [];
  let maxExpense = 50;

  for (let i = count - 1; i >= 0; i -= 1) {
    const dayKey = addDaysToLocalDay(endDay, -i);
    let exp = 0;
    let inc = 0;
    for (const tx of transactions) {
      if (tx.localDay !== dayKey) continue;
      if (tx.kind === 'expense') exp += tx.amountCny;
      else inc += tx.amountCny;
    }
    exp = Math.round(exp * 100) / 100;
    inc = Math.round(inc * 100) / 100;
    if (exp > maxExpense) maxExpense = exp;
    rawDays.push({ localDay: dayKey, expenseCny: exp, incomeCny: inc });
  }

  return rawDays.map((d) => ({
    localDay: d.localDay,
    shortLabel: d.localDay.slice(8, 10),
    expenseCny: d.expenseCny,
    incomeCny: d.incomeCny,
    heightPct: d.expenseCny > 0 ? Math.max(12, Math.round((d.expenseCny / maxExpense) * 100)) : 6,
    isToday: d.localDay === endDay,
  }));
}

export function computeAccountBalances(
  transactions: readonly LedgerTransaction[],
): {
  account: LedgerAccountMeta;
  balanceCny: number;
  monthExpenseCny: number;
  monthIncomeCny: number;
}[] {
  return LEDGER_ACCOUNTS.map((acc) => {
    let delta = 0;
    let monthExp = 0;
    let monthInc = 0;
    for (const tx of transactions) {
      if (tx.accountId !== acc.id) continue;
      if (tx.kind === 'expense') {
        delta -= tx.amountCny;
        monthExp += tx.amountCny;
      } else {
        delta += tx.amountCny;
        monthInc += tx.amountCny;
      }
    }
    return {
      account: acc,
      balanceCny: Math.round((acc.initialBalanceCny + delta) * 100) / 100,
      monthExpenseCny: Math.round(monthExp * 100) / 100,
      monthIncomeCny: Math.round(monthInc * 100) / 100,
    };
  });
}

export function formatLedgerCsv(
  transactions: readonly LedgerTransaction[],
  books: readonly LedgerBook[] = DEFAULT_LEDGER_BOOKS,
): string {
  const header = 'Date,Ledger,Type,Owner,Category,Account,Amount(CNY),Note';
  const rows = transactions.map((tx) => {
    const book = getLedgerBookMeta(tx.ledgerId, books);
    const cat = getLedgerCategoryMeta(tx.categoryId);
    const acc = getLedgerAccountMeta(tx.accountId);
    const ownerMeta = getOwnerBadgeMeta(tx.owner);
    const safeNote = `"${(tx.note || '').replace(/"/g, '""')}"`;
    const signedAmount = tx.kind === 'expense' ? `-${tx.amountCny.toFixed(2)}` : `+${tx.amountCny.toFixed(2)}`;
    return `${tx.localDay},${book.zh},${tx.kind},${ownerMeta.zh},${cat.zh},${acc.zh},${signedAmount},${safeNote}`;
  });
  return [header, ...rows].join('\n');
}
