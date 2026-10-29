import { formatMoney, formatShares, type MoneyCurrency } from './money-format';
import { journalDetail, journalTitle } from './timeline-journal';
import { timelineClock, timelineDayLabel } from './timeline-day';

export type TimelineAccount = {
  id: string;
  name: string;
  currency: string;
};

export type TimelineSource = {
  id: string;
  kind: string;
  occurredAt: string;
  dayKey: string;
  refId: string | null;
  payload: Record<string, unknown>;
};

export type JournalSnapshot = {
  body: string;
  entryDay: string;
  mood: number | null;
  tags: string[];
};

export type PresentedTimelineItem = {
  id: string;
  dayKey: string;
  occurredAt: string;
  title: string;
  detail: string | null;
  /** Automatic amounts go through MaskedAmount. Journal text does not. */
  maskDetail: boolean;
  time: string;
  editable: boolean;
  journal: JournalSnapshot | null;
};

export type TimelineGroup = {
  dayKey: string;
  label: string;
  items: PresentedTimelineItem[];
};

const CURRENCIES = new Set<MoneyCurrency>(['USD', 'SGD', 'HKD', 'CNY']);

export function presentTimeline(
  rows: readonly TimelineSource[],
  accounts: readonly TimelineAccount[],
  timeZone: string,
): PresentedTimelineItem[] {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const items: PresentedTimelineItem[] = [];
  for (const row of rows) {
    const item = presentOne(row, byId.get(row.refId ?? ''), timeZone);
    if (item) items.push(item);
  }
  return items;
}

export function groupTimeline(items: readonly PresentedTimelineItem[], today: string): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (!last || last.dayKey !== item.dayKey) {
      groups.push({ dayKey: item.dayKey, label: timelineDayLabel(item.dayKey, today), items: [item] });
    } else {
      last.items.push(item);
    }
  }
  return groups;
}

function presentOne(
  row: TimelineSource,
  account: TimelineAccount | undefined,
  timeZone: string,
): PresentedTimelineItem | null {
  const time = timelineClock(row.occurredAt, timeZone);
  if (row.kind === 'journal') return presentJournal(row, time);
  if (row.kind === 'balance_recorded') return presentBalance(row, account, time);
  if (row.kind === 'holding_added' || row.kind === 'holding_removed' || row.kind === 'holding_changed') {
    return presentHolding(row, time);
  }
  if (row.kind === 'goal_changed') {
    return item(row, time, '修改了目标', null, true, false);
  }
  return null;
}

function presentJournal(row: TimelineSource, time: string): PresentedTimelineItem | null {
  const body = typeof row.payload.body === 'string' ? row.payload.body : '';
  if (body.trim().length === 0) return null;
  const mood = asMood(row.payload.mood);
  const tags = asTags(row.payload.tags);
  return {
    ...item(row, time, journalTitle(body), journalDetail(mood, tags), false, true),
    journal: { body, entryDay: row.dayKey, mood, tags },
  };
}

function presentBalance(
  row: TimelineSource,
  account: TimelineAccount | undefined,
  time: string,
): PresentedTimelineItem | null {
  if (!account || account.name.trim().length === 0) return null;
  const detail = balanceDetail(row.payload, account.currency);
  return item(row, time, `更新了 ${account.name.trim()} 余额`, detail, true, false);
}

function presentHolding(row: TimelineSource, time: string): PresentedTimelineItem | null {
  const symbol = typeof row.payload.symbol === 'string' ? row.payload.symbol.trim() : '';
  if (row.kind === 'holding_added') return item(row, time, symbol ? `新增持仓 ${symbol}` : '新增持仓', null, true, false);
  if (row.kind === 'holding_removed') {
    return item(row, time, symbol ? `移除了持仓 ${symbol}` : '移除了持仓', null, true, false);
  }
  const title = symbol ? `调整了 ${symbol} 持仓` : '调整了持仓';
  return item(row, time, title, holdingDetail(row.payload), true, false);
}

function item(
  row: TimelineSource,
  time: string,
  title: string,
  detail: string | null,
  maskDetail: boolean,
  editable: boolean,
): PresentedTimelineItem {
  return {
    id: row.id,
    dayKey: row.dayKey,
    occurredAt: row.occurredAt,
    title,
    detail,
    maskDetail: maskDetail && detail != null,
    time,
    editable,
    journal: null,
  };
}

/**
 * Each side uses that balance row's own rate. `before_usd` was already multiplied
 * by the previous row's rate. A USD row with a null rate is one-to-one.
 */
export function balanceDetail(payload: Record<string, unknown>, currency: string): string | null {
  const afterAmount = asNumber(payload.after_amount);
  if (afterAmount == null) return null;
  const beforeAmount = asNumber(payload.before_amount);
  const rate = asNumber(payload.usd_rate);
  const afterUsd = convertedUsd(afterAmount, rate, asNumber(payload.after_usd), currency);
  const beforeUsd =
    beforeAmount == null ? null : convertedUsd(beforeAmount, null, asNumber(payload.before_usd), currency);
  if (afterUsd != null && (beforeAmount == null || beforeUsd != null)) {
    if (beforeAmount == null || beforeUsd == null) return `首次记录 ${formatMoney(afterUsd, 'USD')}`;
    return joinChange(beforeUsd, afterUsd, 'USD');
  }
  if (!isCurrency(currency)) return null;
  if (beforeAmount == null) return `首次记录 ${formatMoney(afterAmount, currency)}`;
  return joinChange(beforeAmount, afterAmount, currency);
}

export function convertedUsd(
  amount: number,
  usdRate: number | null,
  storedUsd: number | null,
  currency: string,
): number | null {
  if (usdRate != null) return amount * usdRate;
  if (storedUsd != null) return storedUsd;
  if (currency === 'USD') return amount;
  return null;
}

function joinChange(before: number, after: number, currency: MoneyCurrency): string {
  const delta = after - before;
  const change = delta > 0 ? `+${formatMoney(delta, currency)}` : formatMoney(delta, currency);
  return `${formatMoney(before, currency)} → ${formatMoney(after, currency)}（${change}）`;
}

function holdingDetail(payload: Record<string, unknown>): string {
  const before = asNumber(payload.before_quantity);
  const after = asNumber(payload.after_quantity);
  if (before != null && after != null && before !== after) {
    return `${formatShares(before)} → ${formatShares(after)} 股`;
  }
  return '调整了成本价';
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0 && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function asMood(value: unknown): number | null {
  const mood = asNumber(value);
  if (mood == null || !Number.isInteger(mood) || mood < 1 || mood > 5) return null;
  return mood;
}

function asTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0);
}

function isCurrency(value: string): value is MoneyCurrency {
  return CURRENCIES.has(value as MoneyCurrency);
}
