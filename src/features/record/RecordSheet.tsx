import { useRef, useState, useSyncExternalStore } from 'react';

import { createId } from '@/core/id';
import { currentTimeZone, sheetAccountingHint } from '@/core/local-day';
import { parseWeightKg } from '@/core/weight-input';
import { formatKg, latestRecord } from '@/core/weight-stats';
import { useWeight } from '@/features/weight/WeightProvider';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Row, Stack } from '@/ui/layout';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { closeRecordSheet, getRecordSheetSnapshot, subscribeRecordSheet } from './record-sheet-store';

const TYPES = [
  { id: 'weight', label: '体重' },
  { id: 'training', label: '训练' },
  { id: 'study', label: '学习' },
  { id: 'block', label: '时间块' },
] as const;

type TypeId = (typeof TYPES)[number]['id'];

export function RecordSheet() {
  const sheet = useSyncExternalStore(subscribeRecordSheet, getRecordSheetSnapshot, getRecordSheetSnapshot);
  const { saving } = useWeight();

  return (
    <Sheet
      visible={sheet.open}
      onClose={() => {
        if (saving) return;
        closeRecordSheet();
      }}
    >
      {sheet.open ? <RecordForm key={sheet.generation} prefillKg={sheet.prefillKg} /> : null}
    </Sheet>
  );
}

function RecordForm({ prefillKg }: { prefillKg: number | null }) {
  const { records, daySwitch, saving, saveWeight } = useWeight();
  const [type, setType] = useState<TypeId>('weight');
  const [value, setValue] = useState(prefillKg == null ? '' : formatKg(prefillKg));
  const [error, setError] = useState<string | null>(null);
  const draftId = useRef<string | null>(null);
  const last = latestRecord(records);
  const hint = sheetAccountingHint(new Date(), currentTimeZone(), daySwitch);

  async function onSave() {
    const weightKg = parseWeightKg(value);
    if (weightKg === null) {
      setError('请输入大于 0、小于 500 的体重');
      return;
    }
    if (!draftId.current) draftId.current = createId();
    const outcome = await saveWeight(weightKg, draftId.current);
    if (outcome === 'deleted') {
      draftId.current = null;
      setValue('');
      setError(null);
      closeRecordSheet();
      return;
    }
    if (outcome !== 'saved') return;
    draftId.current = null;
    setValue('');
    setError(null);
    closeRecordSheet();
  }

  return (
    <Stack gap="lg">
      <Row justify="between">
        <Text variant="heading" accessibilityRole="header">
          记录
        </Text>
        <Button label="关闭" variant="ghost" onPress={closeRecordSheet} disabled={saving} />
      </Row>
      <Row gap="sm" wrap>
        {TYPES.map((item) => (
          <Chip key={item.id} label={item.label} selected={type === item.id} onPress={() => setType(item.id)} />
        ))}
      </Row>
      {type === 'weight' ? (
        <Stack gap="md">
          <TextField
            label="体重（kg）"
            value={value}
            onChangeText={setValue}
            placeholder="例如 72.4"
            keyboardType="decimal-pad"
            autoFocus
            error={error}
            helper={hint ?? undefined}
          />
          {last && prefillKg == null ? (
            <Button
              label={`填入上次 ${formatKg(last.weightKg)}`}
              variant="secondary"
              onPress={() => {
                setValue(formatKg(last.weightKg));
                setError(null);
              }}
            />
          ) : null}
          <Button label="保存" onPress={() => void onSave()} loading={saving} />
        </Stack>
      ) : (
        <Stack gap="sm">
          <Text variant="heading">即将推出</Text>
          <Text variant="muted">{TYPES.find((item) => item.id === type)?.label} 还不能记。这一周先把体重记下来。</Text>
        </Stack>
      )}
    </Stack>
  );
}
