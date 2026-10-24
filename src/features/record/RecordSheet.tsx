import { useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { createId } from '@/core/id';
import { currentTimeZone, sheetAccountingHint } from '@/core/local-day';
import { parseWeightKg } from '@/core/weight-input';
import { formatKg, latestRecord } from '@/core/weight-stats';
import { useWeight } from '@/features/weight/WeightProvider';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { theme } from '@/ui/theme';

import { closeRecordSheet, getRecordSheetOpen, subscribeRecordSheet } from './record-sheet-store';

const TYPES = [
  { id: 'weight', label: '体重', enabled: true },
  { id: 'training', label: '训练', enabled: false },
  { id: 'study', label: '学习', enabled: false },
  { id: 'block', label: '时间块', enabled: false },
] as const;

type TypeId = (typeof TYPES)[number]['id'];

export function RecordSheet() {
  const visible = useSyncExternalStore(subscribeRecordSheet, getRecordSheetOpen, getRecordSheetOpen);
  const { records, daySwitch, saving, saveWeight } = useWeight();
  const [type, setType] = useState<TypeId>('weight');
  const [value, setValue] = useState('');
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
    const saved = await saveWeight(weightKg, draftId.current);
    if (!saved) return;
    draftId.current = null;
    setValue('');
    setError(null);
    closeRecordSheet();
  }

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        if (saving) return;
        closeRecordSheet();
      }}
    >
      <View style={styles.header}>
        <Text variant="heading" accessibilityRole="header">
          记录
        </Text>
        <Button label="关闭" variant="ghost" onPress={closeRecordSheet} disabled={saving} />
      </View>
      <View style={styles.types}>
        {TYPES.map((item) => {
          const selected = type === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setType(item.id)}
              style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}
            >
              <Text variant="body" tone={selected ? 'accent' : 'muted'}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {type === 'weight' ? (
        <View style={styles.form}>
          <TextField
            label="体重（kg）"
            value={value}
            onChangeText={setValue}
            placeholder="例如 72.4"
            keyboardType="decimal-pad"
            error={error}
            helper={hint ?? undefined}
          />
          {last ? (
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
        </View>
      ) : (
        <View style={styles.form}>
          <Text variant="heading">即将推出</Text>
          <Text variant="muted">{TYPES.find((item) => item.id === type)?.label} 还不能记。这一周先把体重记下来。</Text>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm },
  chip: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    borderWidth: theme.border.width,
  },
  chipOn: { backgroundColor: theme.color.accentSoft, borderColor: theme.color.accent },
  chipOff: { backgroundColor: theme.color.paper, borderColor: theme.color.line },
  form: { gap: theme.space.md },
});
