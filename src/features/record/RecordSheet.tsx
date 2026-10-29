import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { createId } from '@/core/id';
import { computeLocalDay, currentTimeZone, sheetAccountingHint } from '@/core/local-day';
import {
  DEFAULT_STUDY_MINUTES,
  parseStudyDraft,
  STUDY_MINUTE_CHOICES,
  type StudyField,
} from '@/core/study';
import {
  BAND_LABEL,
  BAND_LEVELS,
  BLANK_TRAINING_FORM,
  exerciseChoices,
  formatTrainingKg,
  formatTrainingLoad,
  parseTrainingDraft,
  trainingFinishToast,
  trainingFormHasUnsavedEdits,
  trainingSetsOnDay,
  type TrainingFormFields,
  type TrainingMode,
  type TrainingSet,
} from '@/core/training';
import { parseWeightKg } from '@/core/weight-input';
import { formatKg, latestRecord } from '@/core/weight-stats';
import { useStudy } from '@/features/study/StudyProvider';
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

  return (
    <Sheet visible={sheet.open} onClose={closeRecordSheet}>
      {sheet.open ? <RecordForm key={sheet.generation} prefillKg={sheet.prefillKg} initialType={sheet.kind} /> : null}
    </Sheet>
  );
}

function RecordForm({ prefillKg, initialType }: { prefillKg: number | null; initialType: TypeId }) {
  const { records, daySwitch, saveWeight } = useWeight();
  const {
    sets,
    pendingDeleteIds,
    saveSet,
    daySwitch: trainingSwitch,
    recentExercises,
  } = useTraining();
  const study = useStudy();
  const [type, setType] = useState<TypeId>(initialType);
  const [value, setValue] = useState(prefillKg == null ? '' : formatKg(prefillKg));
  const [error, setError] = useState<string | null>(null);
  const [customExercise, setCustomExercise] = useState(false);
  const [exercise, setExercise] = useState('');
  const [reps, setReps] = useState('');
  const [mode, setMode] = useState<TrainingMode>('weight');
  const [load, setLoad] = useState('');
  const [band, setBand] = useState<string>('');
  const [trainingBaseline, setTrainingBaseline] = useState<TrainingFormFields>(BLANK_TRAINING_FORM);
  const [finishConfirm, setFinishConfirm] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [trainingField, setTrainingField] = useState<string | null>(null);
  const [finishedExercise, setFinishedExercise] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [minutesChoice, setMinutesChoice] = useState<number | 'custom'>(DEFAULT_STUDY_MINUTES);
  const [customMinutes, setCustomMinutes] = useState('');
  const [note, setNote] = useState('');
  const [studyError, setStudyError] = useState<string | null>(null);
  const [studyField, setStudyField] = useState<StudyField | null>(null);
  const draftId = useRef<string | null>(null);
  const trainingId = useRef<string | null>(null);
  const studyId = useRef<string | null>(null);
  const exerciseNames = exerciseChoices(recentExercises);
  useEffect(() => {
    if (trainingFormHasUnsavedEdits({ exercise, reps, mode, weight: load, bandLevel: band }, trainingBaseline)) {
      trainingId.current = null;
    }
  }, [band, exercise, load, mode, reps, trainingBaseline]);
  const last = latestRecord(records);
  const hint = sheetAccountingHint(new Date(), currentTimeZone(), daySwitch);
  const accountingDay = computeLocalDay(new Date(), currentTimeZone(), trainingSwitch);
  function currentTrainingForm(): TrainingFormFields {
    return { exercise, reps, mode, weight: load, bandLevel: band };
  }
  const exerciseSets = trainingSetsOnDay(excludePending(sets, pendingDeleteIds), accountingDay).filter(
    (set) => set.exercise === exercise.trim(),
  );

  function onSave() {
    const weightKg = parseWeightKg(value);
    if (weightKg === null) {
      setError('请输入大于 0、小于 500 的体重');
      return;
    }
    if (!draftId.current) draftId.current = createId();
    void saveWeight(weightKg, draftId.current);
    closeRecordSheet();
  }

  function applySet(set: TrainingSet) {
    const known = exerciseNames.includes(set.exercise);
    const next: TrainingFormFields = {
      exercise: set.exercise,
      reps: String(set.reps),
      mode: set.weightKg != null ? 'weight' : 'band',
      weight: set.weightKg != null ? formatTrainingKg(set.weightKg) : '',
      bandLevel: set.weightKg != null ? '' : (set.bandLevel ?? ''),
    };
    setCustomExercise(!known);
    setExercise(next.exercise);
    setReps(next.reps);
    setMode(next.mode);
    setLoad(next.weight);
    setBand(next.bandLevel);
    setTrainingBaseline(next);
    setFinishConfirm(false);
    setTrainingField(null);
    setTrainingError(null);
  }

  function addAnotherSet() {
    const lastSet = exerciseSets[exerciseSets.length - 1];
    if (!lastSet) return;
    applySet(lastSet);
    trainingId.current = null;
  }

  function listedSets(name: string) {
    return trainingSetsOnDay(excludePending(sets, pendingDeleteIds), accountingDay).filter((set) => set.exercise === name);
  }

  function closeFinished() {
    if (finishedExercise) {
      const count = listedSets(finishedExercise).length;
      if (count > 0) showToast({ text: trainingFinishToast(finishedExercise, count, accountingDay) });
    }
    closeRecordSheet();
  }

  async function persistTraining(): Promise<'saved' | 'retry' | 'deleted' | 'invalid'> {
    const draft = parseTrainingDraft({ exercise, reps, mode, weight: load, bandLevel: band });
    if (!draft.ok) {
      setTrainingField(draft.field);
      setTrainingError(draft.error);
      setFinishConfirm(false);
      return 'invalid';
    }
    if (!trainingId.current) trainingId.current = createId();
    const id = trainingId.current;
    const outcome = await saveSet({
      exercise: draft.exercise,
      reps: draft.reps,
      weightKg: draft.weightKg,
      bandLevel: draft.bandLevel,
      existingId: id,
    });
    if (outcome === 'deleted') {
      trainingId.current = null;
      setTrainingError(null);
      closeRecordSheet();
      return 'deleted';
    }
    if (outcome !== 'saved') {
      setFinishConfirm(false);
      return 'retry';
    }
    setFinishedExercise(draft.exercise);
    setExercise(draft.exercise);
    setTrainingBaseline(currentTrainingForm());
    setTrainingField(null);
    setTrainingError(null);
    setFinishConfirm(false);
    return 'saved';
  }

  async function onSaveTraining() {
    await persistTraining();
  }

  function onFinish() {
    if (trainingFormHasUnsavedEdits(currentTrainingForm(), trainingBaseline)) {
      setFinishConfirm(true);
      return;
    }
    closeFinished();
  }

  async function saveAndFinish() {
    const draft = parseTrainingDraft({ exercise, reps, mode, weight: load, bandLevel: band });
    const before = draft.ok ? listedSets(draft.exercise).length : 0;
    const outcome = await persistTraining();
    if (outcome !== 'saved' || !draft.ok) return;
    const after = listedSets(draft.exercise);
    const count = after.some((set) => set.exercise === draft.exercise) ? Math.max(after.length, before + 1) : before + 1;
    showToast({ text: trainingFinishToast(draft.exercise, count, accountingDay) });
    closeRecordSheet();
  }

  async function onSaveStudy() {
    const minutes = minutesChoice === 'custom' ? customMinutes : String(minutesChoice);
    const draft = parseStudyDraft({ topic, minutes, note });
    if (!draft.ok) {
      setStudyField(draft.field);
      setStudyError(draft.error);
      return;
    }
    if (!studyId.current) studyId.current = createId();
    void study.saveRecord({
      topic: draft.topic,
      durationMinutes: draft.durationMinutes,
      note: draft.note,
      existingId: studyId.current,
    });
    closeRecordSheet();
  }

  return (
    <Stack gap="lg">
      <Row justify="between">
        <Text variant="heading" accessibilityRole="header">
          记录
        </Text>
        <Button label="关闭" variant="ghost" onPress={closeRecordSheet} />
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
          <Button label="保存" onPress={onSave} />
        </Stack>
      ) : type === 'training' ? (
        <Stack gap="md">
          <ChipGroup>
            {exerciseNames.map((name) => (
              <Chip
                key={name}
                label={name}
                selected={!customExercise && exercise === name}
                onPress={() => {
                  setCustomExercise(false);
                  setExercise(name);
                  setFinishConfirm(false);
                  setTrainingError(null);
                }}
              />
            ))}
            <Chip
              label="+ 其他"
              selected={customExercise}
              onPress={() => {
                setCustomExercise(true);
                if (exerciseNames.includes(exercise)) setExercise('');
                setFinishConfirm(false);
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
          <Button label="+1 组" variant="secondary" onPress={addAnotherSet} disabled={exerciseSets.length === 0} />
          <Button label="保存这一组" onPress={() => void onSaveTraining()} />
          <Button label="完成" variant="ghost" onPress={onFinish} />
          {finishConfirm ? (
            <Stack gap="sm">
              <Text variant="muted">这一组还没保存</Text>
              <Button label="保存这一组并完成" onPress={() => void saveAndFinish()} />
              <Button label="不保存，直接完成" variant="secondary" onPress={closeFinished} />
            </Stack>
          ) : null}
        </Stack>
      ) : type === 'study' ? (
        <Stack gap="md">
          {study.recentTopics.length > 0 ? (
            <ChipGroup>
              {study.recentTopics.map((name) => (
                <Chip
                  key={name}
                  label={name}
                  selected={topic === name}
                  onPress={() => {
                    setTopic(name);
                    setStudyError(null);
                  }}
                />
              ))}
            </ChipGroup>
          ) : null}
          <TextField
            label="主题"
            value={topic}
            onChangeText={(next) => {
              setTopic(next);
              setStudyError(null);
            }}
            placeholder="例如 AI Infra"
            autoFocus
            error={studyField === 'topic' ? studyError : null}
          />
          <ChipGroup>
            {STUDY_MINUTE_CHOICES.map((minutes) => (
              <Chip
                key={minutes}
                label={String(minutes)}
                selected={minutesChoice === minutes}
                onPress={() => {
                  setMinutesChoice(minutes);
                  setStudyError(null);
                }}
              />
            ))}
            <Chip
              label="自定义"
              selected={minutesChoice === 'custom'}
              onPress={() => {
                setMinutesChoice('custom');
                setStudyError(null);
              }}
            />
          </ChipGroup>
          {minutesChoice === 'custom' ? (
            <TextField
              label="时长（分钟）"
              value={customMinutes}
              onChangeText={(next) => {
                setCustomMinutes(next);
                setStudyError(null);
              }}
              placeholder="例如 20"
              keyboardType="number-pad"
              error={studyField === 'duration' ? studyError : null}
            />
          ) : null}
          <TextField
            label="收获（选填）"
            value={note}
            onChangeText={(next) => {
              setNote(next);
              setStudyError(null);
            }}
            placeholder="一句话"
            error={studyField === 'note' ? studyError : null}
          />
          <Button label="保存" onPress={() => void onSaveStudy()} />
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
