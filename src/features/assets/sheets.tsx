import { useState } from 'react';

import {
  COST_TOTAL_HELPER,
  COST_TOTAL_LABEL,
  HOLDING_CODE_HINT,
  QUANTITY_COST_HINT,
  SYMBOL_HINT,
  accountNameError,
  normalizeSymbol,
  parseAmount,
  quantityError,
  symbolError,
} from '@/core/asset-form';
import { assetSaveNotice } from '@/core/asset-errors';
import type { AssetCurrency } from '@/data/assets';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { ChipGroup } from '@/ui/ChipGroup';
import { Field, Stack } from '@/ui/layout';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { showToast } from '@/ui/toast';

const CURRENCIES: readonly AssetCurrency[] = ['USD', 'CNY', 'SGD', 'HKD'];

async function runSave(save: () => Promise<void>, onClose: () => void, onReload: () => Promise<void>, symbol?: string) {
  try {
    await save();
    onClose();
  } catch (error) {
    const notice = assetSaveNotice(error, symbol);
    if (notice.refresh) {
      showToast({ text: notice.message, tone: 'error' });
      onClose();
      await onReload();
      return notice.message;
    }
    return notice.message;
  }
  return null;
}

export function AccountForm({
  visible,
  onClose,
  onReload,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onReload: () => Promise<void>;
  onSave: (input: { name: string; currency: AssetCurrency }) => Promise<void>;
}) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      {visible ? <AccountFields onClose={onClose} onReload={onReload} onSave={onSave} /> : null}
    </Sheet>
  );
}

function AccountFields({
  onClose,
  onReload,
  onSave,
}: {
  onClose: () => void;
  onReload: () => Promise<void>;
  onSave: (input: { name: string; currency: AssetCurrency }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<AssetCurrency>('USD');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <>
      <Text variant="title" accessibilityRole="header">
        添加账户
      </Text>
      <TextField label="名称" value={name} onChangeText={setName} error={error} />
      <ChipGroup>
        {CURRENCIES.map((item) => (
          <Chip key={item} label={item} selected={currency === item} onPress={() => setCurrency(item)} />
        ))}
      </ChipGroup>
      <Button
        label="保存"
        loading={saving}
        onPress={() => {
          const nameError = accountNameError(name);
          if (nameError) {
            setError(nameError);
            return;
          }
          setSaving(true);
          void runSave(() => onSave({ name: name.trim(), currency }), onClose, onReload).then((message) => {
            setError(message);
            setSaving(false);
          });
        }}
      />
      <Button label="关闭" variant="ghost" onPress={onClose} />
    </>
  );
}

export function BalanceForm({
  visible,
  rows,
  onClose,
  onReload,
  onSave,
}: {
  visible: boolean;
  rows: readonly { id: string; name: string; currency: AssetCurrency; amount: number | null }[];
  onClose: () => void;
  onReload: () => Promise<void>;
  onSave: (changes: readonly { accountId: string; amount: number; currency: AssetCurrency }[]) => Promise<void>;
}) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      {visible ? <BalanceFields rows={rows} onClose={onClose} onReload={onReload} onSave={onSave} /> : null}
    </Sheet>
  );
}

function BalanceFields({
  rows,
  onClose,
  onReload,
  onSave,
}: {
  rows: readonly { id: string; name: string; currency: AssetCurrency; amount: number | null }[];
  onClose: () => void;
  onReload: () => Promise<void>;
  onSave: (changes: readonly { accountId: string; amount: number; currency: AssetCurrency }[]) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const row of rows) next[row.id] = row.amount === null ? '' : String(row.amount);
    return next;
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <>
      <Text variant="title" accessibilityRole="header">
        更新余额
      </Text>
      <Stack gap="md">
        {rows.map((row) => (
          <TextField
            key={row.id}
            label={row.name}
            value={drafts[row.id] ?? ''}
            onChangeText={(value) => setDrafts((current) => ({ ...current, [row.id]: value }))}
            keyboardType="decimal-pad"
            helper="负债填负数"
            error={rows.length === 1 ? error : null}
          />
        ))}
      </Stack>
      {rows.length > 1 && error ? (
        <Text variant="body" tone="danger">
          {error}
        </Text>
      ) : null}
      <Button
        label="保存"
        loading={saving}
        onPress={() => {
          const changes: { accountId: string; amount: number; currency: AssetCurrency }[] = [];
          for (const row of rows) {
            const text = drafts[row.id] ?? '';
            if (text.trim() === '' && row.amount === null) continue;
            const amount = parseAmount(text);
            if (amount === null) {
              setError('金额格式不对');
              return;
            }
            if (row.amount !== null && amount === row.amount) continue;
            changes.push({ accountId: row.id, amount, currency: row.currency });
          }
          if (changes.length === 0) {
            onClose();
            return;
          }
          setSaving(true);
          void runSave(() => onSave(changes), onClose, onReload).then((message) => {
            setError(message);
            setSaving(false);
          });
        }}
      />
      <Button label="关闭" variant="ghost" onPress={onClose} />
    </>
  );
}

export function HoldingForm({
  visible,
  accounts,
  initial,
  onClose,
  onReload,
  onSave,
}: {
  visible: boolean;
  accounts: readonly { id: string; name: string }[];
  initial: { id?: string; accountId: string; accountName: string; symbol: string; quantity: string; cost: string } | null;
  onClose: () => void;
  onReload: () => Promise<void>;
  onSave: (input: {
    accountId: string;
    symbol: string;
    quantity: number;
    costBasisUsd: number | null;
  }) => Promise<void>;
}) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      {visible ? (
        <HoldingFields accounts={accounts} initial={initial} onClose={onClose} onReload={onReload} onSave={onSave} />
      ) : null}
    </Sheet>
  );
}

function HoldingFields({
  accounts,
  initial,
  onClose,
  onReload,
  onSave,
}: {
  accounts: readonly { id: string; name: string }[];
  initial: { id?: string; accountId: string; accountName: string; symbol: string; quantity: string; cost: string } | null;
  onClose: () => void;
  onReload: () => Promise<void>;
  onSave: (input: {
    accountId: string;
    symbol: string;
    quantity: number;
    costBasisUsd: number | null;
  }) => Promise<void>;
}) {
  const editing = Boolean(initial?.id);
  const [accountId, setAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? '');
  const [symbol, setSymbol] = useState(initial?.symbol ?? '');
  const [quantity, setQuantity] = useState(initial?.quantity ?? '');
  const [cost, setCost] = useState(initial?.cost ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <>
      <Text variant="title" accessibilityRole="header">
        {editing ? '编辑持仓' : '添加持仓'}
      </Text>
      {editing ? (
        <Field label="账户" value={initial?.accountName ?? ''} locked hint={HOLDING_CODE_HINT} />
      ) : (
        <ChipGroup>
          {accounts.map((account) => (
            <Chip key={account.id} label={account.name} selected={accountId === account.id} onPress={() => setAccountId(account.id)} />
          ))}
        </ChipGroup>
      )}
      {editing ? (
        <Field label="代码" value={initial?.symbol ?? ''} locked />
      ) : (
        <TextField
          label="代码"
          value={symbol}
          onChangeText={(value) => setSymbol(normalizeSymbol(value))}
          autoCapitalize="none"
          helper={SYMBOL_HINT}
          error={symbol.length > 0 ? symbolError(symbol) : null}
        />
      )}
      <TextField
        label="股数"
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="decimal-pad"
        helper={editing ? QUANTITY_COST_HINT : undefined}
      />
      <TextField label={COST_TOTAL_LABEL} value={cost} onChangeText={setCost} keyboardType="decimal-pad" helper={COST_TOTAL_HELPER} />
      {error ? (
        <Text variant="body" tone="danger">
          {error}
        </Text>
      ) : null}
      <Button
        label="保存"
        loading={saving}
        onPress={() => {
          const nextSymbol = editing ? (initial?.symbol ?? '') : symbol;
          const symbolMessage = symbolError(nextSymbol);
          const shares = parseAmount(quantity);
          const shareMessage = quantityError(shares);
          if (symbolMessage || shareMessage || !accountId) {
            setError(symbolMessage ?? shareMessage ?? '先添加一个账户');
            return;
          }
          let costBasis: number | null = null;
          if (cost.trim().length > 0) {
            const parsed = parseAmount(cost);
            if (parsed === null || parsed < 0) {
              setError('总成本格式不对');
              return;
            }
            costBasis = parsed;
          }
          setSaving(true);
          void runSave(
            () => onSave({ accountId, symbol: nextSymbol, quantity: shares ?? 0, costBasisUsd: costBasis }),
            onClose,
            onReload,
            nextSymbol,
          ).then((message) => {
            setError(message);
            setSaving(false);
          });
        }}
      />
      <Button label="关闭" variant="ghost" onPress={onClose} />
    </>
  );
}

export function AssumptionsForm({
  visible,
  initial,
  onClose,
  onReload,
  onSave,
}: {
  visible: boolean;
  initial: { startUsd: string; startMonth: string; monthlyNet: string; thirdPercent: string };
  onClose: () => void;
  onReload: () => Promise<void>;
  onSave: (input: { startUsd: number; startMonth: string; monthlyNetUsd: number; thirdPercent: number }) => Promise<void>;
}) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      {visible ? <AssumptionFields initial={initial} onClose={onClose} onReload={onReload} onSave={onSave} /> : null}
    </Sheet>
  );
}

function AssumptionFields({
  initial,
  onClose,
  onReload,
  onSave,
}: {
  initial: { startUsd: string; startMonth: string; monthlyNet: string; thirdPercent: string };
  onClose: () => void;
  onReload: () => Promise<void>;
  onSave: (input: { startUsd: number; startMonth: string; monthlyNetUsd: number; thirdPercent: number }) => Promise<void>;
}) {
  const [startUsd, setStartUsd] = useState(initial.startUsd);
  const [startMonth, setStartMonth] = useState(initial.startMonth);
  const [monthlyNet, setMonthlyNet] = useState(initial.monthlyNet);
  const [third, setThird] = useState(initial.thirdPercent);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <>
      <Text variant="title" accessibilityRole="header">
        调整假设
      </Text>
      <TextField label="起始资金" value={startUsd} onChangeText={setStartUsd} keyboardType="decimal-pad" />
      <TextField label="起始月份" value={startMonth} onChangeText={setStartMonth} placeholder="2026-01" />
      <TextField label="每月净存入" value={monthlyNet} onChangeText={setMonthlyNet} keyboardType="decimal-pad" helper="可以填负数" />
      <TextField label="第三档收益率 %" value={third} onChangeText={setThird} keyboardType="decimal-pad" helper="-50 到 50" />
      {error ? (
        <Text variant="body" tone="danger">
          {error}
        </Text>
      ) : null}
      <Button
        label="保存"
        loading={saving}
        onPress={() => {
          const start = parseAmount(startUsd);
          const net = parseAmount(monthlyNet);
          const rate = parseAmount(third);
          if (!/^\d{4}-\d{2}$/.test(startMonth.trim())) {
            setError('月份格式是 2026-01');
            return;
          }
          const month = Number(startMonth.trim().slice(5));
          if (month < 1 || month > 12 || start === null || start < 0 || net === null || rate === null || rate < -50 || rate > 50) {
            setError('请检查起始资金、月份和收益率');
            return;
          }
          setSaving(true);
          void runSave(
            () => onSave({ startUsd: start, startMonth: startMonth.trim(), monthlyNetUsd: net, thirdPercent: rate }),
            onClose,
            onReload,
          ).then((message) => {
            setError(message);
            setSaving(false);
          });
        }}
      />
      <Button label="关闭" variant="ghost" onPress={onClose} />
    </>
  );
}

export function GoalForm({
  visible,
  initial,
  onClose,
  onReload,
  onSave,
}: {
  visible: boolean;
  initial: string;
  onClose: () => void;
  onReload: () => Promise<void>;
  onSave: (targetUsd: number) => Promise<void>;
}) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      {visible ? <GoalFields initial={initial} onClose={onClose} onReload={onReload} onSave={onSave} /> : null}
    </Sheet>
  );
}

function GoalFields({
  initial,
  onClose,
  onReload,
  onSave,
}: {
  initial: string;
  onClose: () => void;
  onReload: () => Promise<void>;
  onSave: (targetUsd: number) => Promise<void>;
}) {
  const [target, setTarget] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <>
      <Text variant="title" accessibilityRole="header">
        目标
      </Text>
      <TextField label="目标金额" value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
      {error ? (
        <Text variant="body" tone="danger">
          {error}
        </Text>
      ) : null}
      <Button
        label="保存"
        loading={saving}
        onPress={() => {
          const amount = parseAmount(target);
          if (amount === null || amount <= 0) {
            setError('目标金额要大于 0');
            return;
          }
          setSaving(true);
          void runSave(() => onSave(amount), onClose, onReload).then((message) => {
            setError(message);
            setSaving(false);
          });
        }}
      />
      <Button label="关闭" variant="ghost" onPress={onClose} />
    </>
  );
}
