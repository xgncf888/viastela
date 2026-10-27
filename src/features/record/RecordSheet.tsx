import { useRef, useState, useSyncExternalStore } from 'react';

import { createId } from '@/core/id';
import { computeLocalDay, currentTimeZone, sheetAccountingHint } from '@/core/local-day';
import {
  BAND_LABEL,
  BAND_LEVELS,
  formatTrainingKg,
  formatTrainingLoad,
  parseTrainingDraft,
  trainingFinishToast,
  trainingSetsOnDay,
  type TrainingMode,
  type TrainingSet,
} from '@/core/training';
import { parseWeightKg } from '@/core/weight-input';
import { formatKg, latestRecord } from '@/core/weight-stats';
import { useTraining } from '@/features/training/TrainingProvider';
import { excludePending } from '@/features/weight/weight-copy';
import { useWeight } from '@/features/weight/WeightProvider';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { ChipGroup } from '@/ui/ChipGroup';
import { Row, Stack } from '@/ui/layout';
import { SetRow } from '@/ui/SetRow';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { showToast } from '@/ui/toast';

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
  const { saving: weightSaving } = useWeight();
  const { saving: trainingSaving } = useTraining();
  const saving = weightSaving || trainingSaving;

  return (
    <Sheet
      visible={sheet.open}
      onClose={() => {
        if (saving) return;
        closeRecordSheet();
      }}
    >
      {sheet.open ? <RecordForm key={sheet.generation} prefillKg={sheet.prefillKg} initialType={sheet.kind} /> : null}
    </Sheet>
  );
}

function RecordForm({ prefillKg, initialType }: { prefillKg: number | null; initialType: TypeId }) {
  const { records, daySwitch, saving: weightSaving, saveWeight } = useWeight();
  const {
    sets,
    pendingDeleteIds,
    saving: trainingSaving,
    saveSet,
    daySwitch: trainingSwitch,
    recentExercises,
  } = useTraining();
  const saving = weightSaving || trainingSaving;
  const [type, setType] = useState<TypeId>(initialType);
  const [value, setValue] = useState(prefillKg == null ? '' : formatKg(prefillKg));
  const [error, setError] = useState<string | null>(null);
  const [customExercise, setCustomExercise] = useState(recentExercises.length === 0);
  const [exercise, setExercise] = useState('');
  const [reps, setReps] = useState('');
  const [mode, setMode] = useState<TrainingMode>('weight');
  const [load, setLoad] = useState('');
  const [band, setBand] = useState<string>('');
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [trainingField, setTrainingField] = useState<string | null>(null);
  const [finishedExercise, setFinishedExercise] = useState<string | null>(null);
  const draftId = useRef<string | null>(null);
  const trainingId = useRef<string | null>(null);
  const last = latestRecord(records);
  const hint = sheetAccountingHint(new Date(), currentTimeZone(), daySwitch);
  const accountingDay = computeLocalDay(new Date(), currentTimeZone(), trainingSwitch);
  const exerciseSets = trainingSetsOnDay(excludePending(sets, pendingDeleteIds), accountingDay).filter(
    (set) => set.exercise === exercise.trim(),
  );

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

  function applySet(set: TrainingSet) {
    const known = recentExercises.includes(set.exercise);
    setCustomExercise(!known);
    setExercise(set.exercise);
    setReps(String(set.reps));
    if (set.weightKg != null) {
      setMode('weight');
      setLoad(formatTrainingKg(set.weightKg));
      setBand('');
    } else {
      setMode('band');
      setLoad('');
      setBand(set.bandLevel ?? '');
    }
    setTrainingField(null);
    setTrainingError(null);
  }

  function addAnotherSet() {
    const lastSet = exerciseSets[exerciseSets.length - 1];
    if (!lastSet) return;
    applySet(lastSet);
    trainingId.current = null;
  }

  async function onSaveTraining() {
    const draft = parseTrainingDraft({ exercise, reps, mode, weight: load, bandLevel: band });
    if (!draft.ok) {
      setTrainingField(draft.field);
      setTrainingError(draft.error);
      return;
    }
    if (!trainingId.current) trainingId.current = createId();
    const outcome = await saveSet({
      exercise: draft.exercise,
      reps: draft.reps,
      weightKg: draft.weightKg,
      bandLevel: draft.bandLevel,
      existingId: trainingId.current,
    });
    if (outcome === 'deleted') {
      trainingId.current = null;
      setTrainingError(null);
      closeRecordSheet();
      return;
    }
    if (outcome !== 'saved') return;
    trainingId.current = null;
    setFinishedExercise(draft.exercise);
    setExercise(draft.exercise);
    setTrainingField(null);
    setTrainingError(null);
  }

  function onFinish() {
    if (finishedExercise) {
      const count = trainingSetsOnDay(excludePending(sets, pendingDeleteIds), accountingDay).filter(
        (set) => set.exercise === finishedExercise,
      ).length;
      if (count > 0) showToast({ text: trainingFinishToast(finishedExercise, count, accountingDay) });
    }
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
      <ChipGroup>
        {TYPES.map((item) => (
          <Chip key={item.id} label={item.label} selected={type === item.id} onPress={() => setType(item.id)} />
        ))}
      </ChipGroup>
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
      ) : type === 'training' ? (
        <Stack gap="md">
          <ChipGroup>
            {recentExercises.map((name) => (
              <Chip
                key={name}
                label={name}
                selected={!customExercise && exercise === name}
                onPress={() => {
                  setCustomExercise(false);
                  setExercise(name);
                  setTrainingError(null);
                }}
              />
            ))}
            <Chip
              label="+ 其他"
              selected={customExercise}
              onPress={() => {
                setCustomExercise(true);
                if (recentExercises.includes(exercise)) setExercise('');
                setTrainingError(null);
              }}
            />
          </ChipGroup>
          {customExercise ? (
            <TextField
              label="动作"
              value={exercise}
              onChangeText={(next) => {
                setExercise(next);
                setTrainingError(null);
              }}
              placeholder="例如 卧推"
              autoFocus
              error={trainingField === 'exercise' ? trainingError : null}
            />
          ) : null}
          <ChipGroup>
            <Chip
              label="重量"
              selected={mode === 'weight'}
              onPress={() => {
                setMode('weight');
                setTrainingError(null);
              }}
            />
            <Chip
              label="弹力带"
              selected={mode === 'band'}
              onPress={() => {
                setMode('band');
                setTrainingError(null);
              }}
            />
          </ChipGroup>
          {mode === 'weight' ? (
            <TextField
              label="重量（kg）"
              value={load}
              onChangeText={(next) => {
                setLoad(next);
                setTrainingError(null);
              }}
              placeholder="例如 40"
              keyboardType="decimal-pad"
              error={trainingField === 'weight' ? trainingError : null}
            />
          ) : (
            <Stack gap="sm">
              <ChipGroup>
                {BAND_LEVELS.map((level) => (
                  <Chip
                    key={level}
                    label={BAND_LABEL[level]}
                    selected={band === level}
                    onPress={() => {
                      setBand(level);
                      setTrainingError(null);
                    }}
                  />
                ))}
              </ChipGroup>
              {trainingField === 'band' && trainingError ? (
                <Text variant="muted" tone="danger">
                  {trainingError}
                </Text>
              ) : null}
            </Stack>
          )}
          <TextField
            label="次数"
            value={reps}
            onChangeText={(next) => {
              setReps(next);
              setTrainingError(null);
            }}
            placeholder="例如 8"
            keyboardType="number-pad"
            error={trainingField === 'reps' ? trainingError : null}
          />
          {exerciseSets.map((set) => (
            <SetRow key={set.id} title={set.exercise} detail={`${set.reps} 次 · ${formatTrainingLoad(set)}`} />
          ))}
          <Button label="保存这一组" onPress={() => void onSaveTraining()} loading={saving} />
          <Button label="+1 组" variant="secondary" onPress={addAnotherSet} disabled={saving || exerciseSets.length === 0} />
          <Button label="完成" variant="secondary" onPress={onFinish} disabled={saving} />
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
