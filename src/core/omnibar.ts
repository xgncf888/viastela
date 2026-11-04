import {
  evaluateAmountExpression,
  getLedgerCategoryMeta,
  type LedgerAccountId,
  type LedgerCategoryId,
  type LedgerEntryKind,
  type LedgerOwnerId,
  parseQuickBookkeepingInput,
} from './bookkeeping';

export type OmnibarIntent =
  | {
      kind: 'weight';
      weightKg: number;
      summaryZh: string;
      summaryEn: string;
      badgeZh: string;
      badgeEn: string;
    }
  | {
      kind: 'training';
      exercise: string;
      reps: number;
      setsCount: number;
      weightKg: number | null;
      summaryZh: string;
      summaryEn: string;
      badgeZh: string;
      badgeEn: string;
    }
  | {
      kind: 'study';
      topic: string;
      durationMinutes: number;
      note: string | null;
      summaryZh: string;
      summaryEn: string;
      badgeZh: string;
      badgeEn: string;
    }
  | {
      kind: 'ledger';
      entryKind: LedgerEntryKind;
      amountCny: number;
      categoryId: LedgerCategoryId;
      accountId: LedgerAccountId;
      owner: LedgerOwnerId;
      note: string;
      summaryZh: string;
      summaryEn: string;
      badgeZh: string;
      badgeEn: string;
    };

const WORKOUT_KEYWORDS = [
  '卧推',
  '深蹲',
  '硬拉',
  '引体',
  '引体向上',
  '俯卧撑',
  '推举',
  '划船',
  '弯举',
  '臂屈伸',
  '飞鸟',
  '侧平举',
  '卷腹',
  '平板支撑',
  '波比跳',
  '跑步',
  '哑铃',
  '杠铃',
  'bench',
  'squat',
  'deadlift',
  'pullup',
  'pushup',
];

const STUDY_PREFIX_RE = /^(?:学习|读书|阅读|专注|研究|精读|背诵|刷题|看书|读|看|学|read|study|focus)\s+/i;

/**
 * Parses a natural-language one-line command from the Charioteer-style Omnibar (`⌘P` or mobile bar)
 * into a structured action for Weight, Training, Study, or Ledger.
 */
export function parseOmnibarCommand(raw: string): OmnibarIntent | null {
  const input = raw.trim();
  if (!input) return null;

  // 1. Weight pattern: "72.4kg", "晨重 72.4", "体重 71.8kg", "weigh 72.1"
  const weightMatch =
    /^(?:晨重|体重|weight|weigh)?\s*(\d{2,3}(?:\.\d{1,2})?)\s*(?:kg|公斤|千克)$/i.exec(input) ??
    /^(?:晨重|体重|weight|weigh)\s*(\d{2,3}(?:\.\d{1,2})?)\s*(?:kg|公斤|千克)?$/i.exec(input);
  if (weightMatch) {
    const kg = Number(weightMatch[1]);
    if (Number.isFinite(kg) && kg >= 25 && kg < 350) {
      return {
        kind: 'weight',
        weightKg: Math.round(kg * 10) / 10,
        summaryZh: `记入今日晨重 ${kg.toFixed(1)} kg`,
        summaryEn: `Log morning weight ${kg.toFixed(1)} kg`,
        badgeZh: '⚖️ 晨重秒记',
        badgeEn: '⚖️ Weight Log',
      };
    }
  }

  // 2. Workout pattern: "卧推 60kg 8x4", "深蹲 80kg 10次", "引体向上 12x3", "俯卧撑 25次"
  const hasWorkoutKeyword = WORKOUT_KEYWORDS.some((kw) => input.toLowerCase().includes(kw));
  const workoutSetMatch =
    /^([^\d\s]+(?:\s+[^\d\s]+)?)\s+(?:(\d+(?:\.\d+)?)\s*(?:kg|公斤)\s*)?(\d{1,3})\s*(?:[x×*]\s*(\d{1,2})|次|reps?)(?:\s*(?:[x×*]\s*(\d{1,2})\s*组?))?$/i.exec(
      input,
    );
  if (workoutSetMatch && (hasWorkoutKeyword || workoutSetMatch[2] !== undefined || /[x×*]/.test(input))) {
    const exercise = workoutSetMatch[1]!.trim();
    const weightKg = workoutSetMatch[2] ? Number(workoutSetMatch[2]) : null;
    const reps = Math.max(1, Math.min(200, Number(workoutSetMatch[3])));
    const setsCount = Math.max(1, Math.min(10, Number(workoutSetMatch[4] ?? workoutSetMatch[5] ?? 1)));
    const loadLabel = weightKg != null ? `${weightKg}kg × ` : '自重 × ';
    return {
      kind: 'training',
      exercise,
      reps,
      setsCount,
      weightKg,
      summaryZh: `${exercise} · ${loadLabel}${reps}次${setsCount > 1 ? ` × ${setsCount}组` : ''}`,
      summaryEn: `${exercise} · ${loadLabel}${reps} reps${setsCount > 1 ? ` × ${setsCount} sets` : ''}`,
      badgeZh: '🏋️ 训练组秒记',
      badgeEn: '🏋️ Workout Log',
    };
  }

  // 3. Study pattern: "读 DDIA 45m", "学习 AI Infra 60分钟", "专注 Rust 30m 内存模型"
  const studyDurationMatch =
    /^(?:学习|读书|阅读|专注|研究|精读|看书|read|study|focus)?\s*(.+?)\s+(\d{1,3})\s*(?:m|min|mins|分钟|分)(?:\s+(.*))?$/i.exec(
      input,
    );
  if (studyDurationMatch) {
    const rawTopic = studyDurationMatch[1]!.replace(STUDY_PREFIX_RE, '').trim();
    const mins = Number(studyDurationMatch[2]);
    const note = studyDurationMatch[3]?.trim() || null;
    if (rawTopic && Number.isFinite(mins) && mins >= 1 && mins <= 720) {
      return {
        kind: 'study',
        topic: rawTopic,
        durationMinutes: Math.round(mins),
        note,
        summaryZh: `专注「${rawTopic}」${Math.round(mins)} 分钟${note ? ` · ${note}` : ''}`,
        summaryEn: `Focus "${rawTopic}" for ${Math.round(mins)}m${note ? ` · ${note}` : ''}`,
        badgeZh: '📚 专注秒记',
        badgeEn: '📚 Study Log',
      };
    }
  }

  // 4. Ledger pattern: "瑞幸拿铁 18 微信", "午饭 35+12", "打车 28 支付宝", "发工资 +18000"
  // Avoid matching plain numbers without context that could be search queries unless prefixed with ¥ or +/-
  const hasCurrencyOrMath = /[¥￥]|(?:\d+\s*[+]\s*\d+)/.test(input);
  const parsedLedger = parseQuickBookkeepingInput(input, 'dining', 'wechat', 'me');
  if (parsedLedger && ( parsedLedger.note !== '日常收支' || hasCurrencyOrMath )) {
    const cat = getLedgerCategoryMeta(parsedLedger.categoryId);
    const sign = parsedLedger.kind === 'income' ? '+' : '-';
    return {
      kind: 'ledger',
      entryKind: parsedLedger.kind,
      amountCny: parsedLedger.amountCny,
      categoryId: parsedLedger.categoryId,
      accountId: parsedLedger.accountId,
      owner: parsedLedger.owner,
      note: parsedLedger.note,
      summaryZh: `[${cat.zh}] ${parsedLedger.note} ${sign}¥${parsedLedger.amountCny.toFixed(2)}`,
      summaryEn: `[${cat.en}] ${parsedLedger.note} ${sign}¥${parsedLedger.amountCny.toFixed(2)}`,
      badgeZh: '¥ 账本秒记',
      badgeEn: '¥ Ledger Log',
    };
  }

  const pureMath = hasCurrencyOrMath ? evaluateAmountExpression(input.replace(/[¥￥]/g, '')) : null;
  if (pureMath !== null && pureMath > 0) {
    return {
      kind: 'ledger',
      entryKind: 'expense',
      amountCny: pureMath,
      categoryId: 'dining',
      accountId: 'wechat',
      owner: 'me',
      note: '快捷记账',
      summaryZh: `[餐饮美食] 快捷记账 -¥${pureMath.toFixed(2)}`,
      summaryEn: `[Dining] Quick Expense -¥${pureMath.toFixed(2)}`,
      badgeZh: '¥ 账本秒记',
      badgeEn: '¥ Ledger Log',
    };
  }

  return null;
}
