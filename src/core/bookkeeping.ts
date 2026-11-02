/**
 * Core domain model, natural-language parser, budget burn-rate engine,
 * category breakdown, and 14-day daily trend calculator for the dedicated
 * Bookkeeping (记账) module.
 */

import { addDaysToLocalDay } from './life-milestones-okr';

export type LedgerEntryKind = 'expense' | 'income';

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

export type LedgerCategoryMeta = {
  id: LedgerCategoryId;
  kind: LedgerEntryKind;
  icon: string;
  zh: string;
  en: string;
  color: string;
  keywords: readonly string[];
};

export type LedgerAccountMeta = {
  id: LedgerAccountId;
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
};

export type QuickLedgerPreset = {
  id: string;
  icon: string;
  zh: string;
  en: string;
  amountCny: number;
  categoryId: LedgerCategoryId;
  accountId: LedgerAccountId;
};

export type BookkeepingState = {
  monthlyBudgetCny: number;
  currencySymbol: string;
  transactions: LedgerTransaction[];
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

export const LEDGER_CATEGORIES: readonly LedgerCategoryMeta[] = [
  {
    id: 'dining',
    kind: 'expense',
    icon: '🍜',
    zh: '餐饮美食',
    en: 'Dining',
    color: '#f59e0b',
    keywords: ['饭', '餐', '面', '火锅', '烧烤', '外卖', '美团', '饿了么', '早饭', '午饭', '晚饭', '夜宵', 'lunch', 'dinner', 'food', 'meal'],
  },
  {
    id: 'coffee',
    kind: 'expense',
    icon: '☕',
    zh: '咖啡茶饮',
    en: 'Coffee & Tea',
    color: '#d97706',
    keywords: ['咖啡', '瑞幸', '星巴克', '奶茶', '喜茶', '霸王茶姬', '拿铁', '美式', '下午茶', 'coffee', 'latte', 'tea', 'boba'],
  },
  {
    id: 'transit',
    kind: 'expense',
    icon: '🚇',
    zh: '交通出行',
    en: 'Transit',
    color: '#38bdf8',
    keywords: ['地铁', '打车', '滴滴', '公交', '高铁', '机票', '加油', '停车', '过路费', 'uber', 'grab', 'taxi', 'mrt', 'bus'],
  },
  {
    id: 'shopping',
    kind: 'expense',
    icon: '🛒',
    zh: '日用百货',
    en: 'Shopping',
    color: '#ec4899',
    keywords: ['超市', '盒马', '山姆', '淘宝', '京东', '拼多多', '日用', '衣服', '纸巾', '水果', '买菜', 'grocery', 'shop', 'amazon'],
  },
  {
    id: 'housing',
    kind: 'expense',
    icon: '🏠',
    zh: '居住生活',
    en: 'Housing & Bills',
    color: '#8b5cf6',
    keywords: ['房租', '水电', '燃气', '物业', '宽带', '话费', '手机费', 'rent', 'utility', 'wifi', 'bill'],
  },
  {
    id: 'entertainment',
    kind: 'expense',
    icon: '🎮',
    zh: '娱乐订阅',
    en: 'Fun & Subs',
    color: '#a855f7',
    keywords: ['电影', '会员', '订阅', '游戏', '演出', '展览', '旅行', '酒店', 'netflix', 'spotify', 'icloud', 'movie', 'game'],
  },
  {
    id: 'fitness',
    kind: 'expense',
    icon: '🏋️',
    zh: '运动健康',
    en: 'Health & Gym',
    color: '#10b981',
    keywords: ['健身', '蛋白粉', '私教', '游泳', '羽毛球', '体检', '买药', '医院', '补剂', 'gym', 'protein', 'health'],
  },
  {
    id: 'study',
    kind: 'expense',
    icon: '📚',
    zh: '书籍课程',
    en: 'Books & Study',
    color: '#eab308',
    keywords: ['买书', '书籍', '课程', '培训', '考试', '极客时间', 'claude', 'openai', 'cursor', 'book', 'course'],
  },
  {
    id: 'digital',
    kind: 'expense',
    icon: '💻',
    zh: '数码装备',
    en: 'Tech & Gear',
    color: '#06b6d4',
    keywords: ['键盘', '鼠标', '显示器', '镜头', '手机', '充电器', '耳机', '镜头', 'mac', 'iphone', 'gear'],
  },
  {
    id: 'salary',
    kind: 'income',
    icon: '💰',
    zh: '薪资收入',
    en: 'Salary',
    color: '#34d399',
    keywords: ['工资', '薪水', '月薪', '发薪', '稿费', 'salary', 'paycheck', 'wage'],
  },
  {
    id: 'investment',
    kind: 'income',
    icon: '📈',
    zh: '理财分红',
    en: 'Investment',
    color: '#10b981',
    keywords: ['分红', '利息', '股票', '基金', '定投收益', '理财', 'dividend', 'interest', 'yield'],
  },
  {
    id: 'bonus',
    kind: 'income',
    icon: '🎁',
    zh: '奖金副业',
    en: 'Bonus & Side',
    color: '#f5b942',
    keywords: ['奖金', '红包', '报销', '兼职', '副业', '闲鱼', '退款', 'bonus', 'refund', 'side'],
  },
];

export const LEDGER_ACCOUNTS: readonly LedgerAccountMeta[] = [
  {
    id: 'alipay',
    icon: '💙',
    zh: '支付宝',
    en: 'Alipay',
    color: '#38bdf8',
    initialBalanceCny: 6800,
    keywords: ['支付宝', '花呗', 'alipay'],
  },
  {
    id: 'wechat',
    icon: '💚',
    zh: '微信支付',
    en: 'WeChat Pay',
    color: '#34d399',
    initialBalanceCny: 4200,
    keywords: ['微信', '零钱', 'wechat', 'wx'],
  },
  {
    id: 'bank',
    icon: '🏦',
    zh: '招商银行卡',
    en: 'Bank Card',
    color: '#f5b942',
    initialBalanceCny: 36500,
    keywords: ['招行', '银行卡', '工资卡', '信用卡', 'bank', 'card', 'cmb'],
  },
  {
    id: 'applepay',
    icon: '🍎',
    zh: 'Apple Pay',
    en: 'Apple Pay',
    color: '#f472b6',
    initialBalanceCny: 2500,
    keywords: ['apple', '现金', '八达通', 'cash'],
  },
];

export const QUICK_LEDGER_PRESETS: readonly QuickLedgerPreset[] = [
  {
    id: 'preset-coffee',
    icon: '☕',
    zh: '冰美式/拿铁',
    en: 'Iced Latte',
    amountCny: 18,
    categoryId: 'coffee',
    accountId: 'wechat',
  },
  {
    id: 'preset-lunch',
    icon: '🍜',
    zh: '工作午餐',
    en: 'Work Lunch',
    amountCny: 36,
    categoryId: 'dining',
    accountId: 'alipay',
  },
  {
    id: 'preset-transit',
    icon: '🚇',
    zh: '地铁通勤',
    en: 'Subway',
    amountCny: 6,
    categoryId: 'transit',
    accountId: 'applepay',
  },
  {
    id: 'preset-grocery',
    icon: '🛒',
    zh: '盒马鲜生采购',
    en: 'Groceries',
    amountCny: 88,
    categoryId: 'shopping',
    accountId: 'alipay',
  },
  {
    id: 'preset-dinner',
    icon: '🥗',
    zh: '减脂能量轻食',
    en: 'Healthy Bowl',
    amountCny: 42,
    categoryId: 'dining',
    accountId: 'wechat',
  },
  {
    id: 'preset-protein',
    icon: '🏋️',
    zh: '运动蛋白饮',
    en: 'Protein Shake',
    amountCny: 25,
    categoryId: 'fitness',
    accountId: 'wechat',
  },
];

export const DEFAULT_BOOKKEEPING_STATE: BookkeepingState = {
  monthlyBudgetCny: 6000,
  currencySymbol: '¥',
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
    },
    {
      id: 'tx-seed-2',
      kind: 'expense',
      amountCny: 168,
      categoryId: 'shopping',
      accountId: 'alipay',
      note: '盒马生鲜牛排与蓝莓采购',
      localDay: '2026-11-01',
      createdAt: '2026-11-01T18:20:00.000Z',
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
    },
    {
      id: 'tx-seed-4',
      kind: 'expense',
      amountCny: 45,
      categoryId: 'dining',
      accountId: 'wechat',
      note: '烤鸡胸肉牛油果波奇饭',
      localDay: '2026-11-02',
      createdAt: '2026-11-02T12:40:00.000Z',
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
    },
  ],
};

export function getLedgerCategoryMeta(id: LedgerCategoryId): LedgerCategoryMeta {
  return LEDGER_CATEGORIES.find((c) => c.id === id) ?? LEDGER_CATEGORIES[0]!;
}

export function getLedgerAccountMeta(id: LedgerAccountId): LedgerAccountMeta {
  return LEDGER_ACCOUNTS.find((a) => a.id === id) ?? LEDGER_ACCOUNTS[0]!;
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

/**
 * Parses natural language quick input such as:
 * - `"瑞幸生椰拿铁 18"` -> `{ kind: 'expense', categoryId: 'coffee', amountCny: 18, note: '瑞幸生椰拿铁' }`
 * - `"盒马买菜 86.5 支付宝"` -> `{ kind: 'expense', categoryId: 'shopping', accountId: 'alipay', amountCny: 86.5, note: '盒马买菜' }`
 * - `"发工资 +25000 招行"` -> `{ kind: 'income', categoryId: 'salary', accountId: 'bank', amountCny: 25000, note: '发工资' }`
 */
export function parseQuickBookkeepingInput(
  rawText: string,
  fallbackCategoryId: LedgerCategoryId = 'dining',
  fallbackAccountId: LedgerAccountId = 'wechat',
): {
  kind: LedgerEntryKind;
  amountCny: number;
  categoryId: LedgerCategoryId;
  accountId: LedgerAccountId;
  note: string;
} | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  // Match mathematical expression or number
  const mathMatch = trimmed.match(/([+-]?\d+(?:\.\d+)?(?:\s*[+-]\s*\d+(?:\.\d+)?)*)/);
  if (!mathMatch) return null;

  const rawNumberToken = mathMatch[1]!;
  const amountCny = evaluateAmountExpression(rawNumberToken);
  if (!amountCny || amountCny <= 0) return null;

  const lower = trimmed.toLowerCase();
  const hasPlusPrefix = rawNumberToken.trim().startsWith('+') || trimmed.includes('收入') || trimmed.includes('入账');

  // Detect account if mentioned
  let detectedAccount: LedgerAccountId = fallbackAccountId;
  for (const acc of LEDGER_ACCOUNTS) {
    if (acc.keywords.some((kw) => lower.includes(kw))) {
      detectedAccount = acc.id;
      break;
    }
  }

  // Detect category by keywords
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

  // Strip the number and account keyword to form a clean note
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
    note: cleanNote,
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
): MonthlyBookkeepingSummary {
  const yearMonth = /^\d{4}-\d{2}/.test(todayLocalDay) ? todayLocalDay.slice(0, 7) : '2026-11';
  const dayOfMonth = /^\d{4}-\d{2}-\d{2}$/.test(todayLocalDay)
    ? Math.max(1, Number.parseInt(todayLocalDay.slice(8, 10), 10))
    : 1;
  const totalDays = daysInYearMonth(yearMonth);
  const daysLeftInMonth = Math.max(1, totalDays - dayOfMonth + 1);

  let totalExpenseCny = 0;
  let totalIncomeCny = 0;
  let todayExpenseCny = 0;
  let todayIncomeCny = 0;

  for (const tx of state.transactions) {
    if (tx.localDay.startsWith(yearMonth)) {
      if (tx.kind === 'expense') {
        totalExpenseCny += tx.amountCny;
      } else {
        totalIncomeCny += tx.amountCny;
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

  const monthlyBudgetCny = Math.max(100, state.monthlyBudgetCny || 6000);
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

export function formatLedgerCsv(transactions: readonly LedgerTransaction[]): string {
  const header = 'Date,Type,Category,Account,Amount(CNY),Note';
  const rows = transactions.map((tx) => {
    const cat = getLedgerCategoryMeta(tx.categoryId);
    const acc = getLedgerAccountMeta(tx.accountId);
    const safeNote = `"${(tx.note || '').replace(/"/g, '""')}"`;
    const signedAmount = tx.kind === 'expense' ? `-${tx.amountCny.toFixed(2)}` : `+${tx.amountCny.toFixed(2)}`;
    return `${tx.localDay},${tx.kind},${cat.zh},${acc.zh},${signedAmount},${safeNote}`;
  });
  return [header, ...rows].join('\n');
}
