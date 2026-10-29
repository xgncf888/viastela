import { useState } from 'react';

import { createId } from '@/core/id';
import { formatMonthDay, shiftLocalDay } from '@/core/local-day';
import {
  FUTURE_DAY_MESSAGE,
  JOURNAL_TAGS_MESSAGE,
  timelineSaveNotice,
  type TimelineSaveNotice,
} from '@/core/timeline-errors';
import {
  MOOD_LABELS,
  normalizeJournalDraft,
  validateJournal,
  type JournalDraft,
} from '@/core/timeline-journal';
import { saveJournal } from '@/data/timeline';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { ChipGroup } from '@/ui/ChipGroup';
import { Row, Stack } from '@/ui/layout';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { showToast } from '@/ui/toast';

import { JournalField } from './JournalField';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const RECENT_DAYS = 7;

export type JournalSeed = {
  id: string;
  body: string;
  entryDay: string;
  mood: number | null;
  tags: string[];
};

export function JournalSheet({
  visible,
  today,
  timeZone,
  seed,
  onClose,
  onSaved,
  onNotice,
}: {
  visible: boolean;
  today: string;
  timeZone: string;
  seed: JournalSeed | null;
  onClose: () => void;
  onSaved: () => void;
  onNotice: (notice: TimelineSaveNotice) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      {visible ? (
        <JournalForm
          key={seed?.id ?? 'new'}
          today={today}
          timeZone={timeZone}
          seed={seed}
          onClose={onClose}
          onSaved={onSaved}
          onNotice={onNotice}
        />
      ) : null}
    </Sheet>
  );
}

function JournalForm({
  today,
  timeZone,
  seed,
  onClose,
  onSaved,
  onNotice,
}: {
  today: string;
  timeZone: string;
  seed: JournalSeed | null;
  onClose: () => void;
  onSaved: () => void;
  onNotice: (notice: TimelineSaveNotice) => void;
}) {
  const [id] = useState(() => seed?.id ?? createId());
  const [body, setBody] = useState(seed?.body ?? '');
  const [entryDay, setEntryDay] = useState(seed?.entryDay ?? today);
  const [mood, setMood] = useState<number | null>(seed?.mood ?? null);
  const [tags, setTags] = useState<string[]>(seed?.tags ?? []);
  const [tagDraft, setTagDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const recent = Array.from({ length: RECENT_DAYS }, (_, index) => shiftLocalDay(today, -index));
  const futureLabel = formatMonthDay(shiftLocalDay(today, 1));

  function addTag() {
    const next = tagDraft.trim();
    if (next.length < 1 || next.length > 20 || tags.length >= 5) {
      setError(JOURNAL_TAGS_MESSAGE);
      return;
    }
    if (tags.includes(next)) {
      setTagDraft('');
      return;
    }
    setTags([...tags, next]);
    setTagDraft('');
    setError(null);
  }

  async function onSave() {
    const draft: JournalDraft = { body, entryDay, mood, tags };
    const invalid = validateJournal(draft, today);
    if (invalid) {
      setError(invalid);
      return;
    }
    const normalized = normalizeJournalDraft(draft);
    setSaving(true);
    setError(null);
    try {
      await saveJournal({
        id,
        body: normalized.body,
        entryDay: normalized.entryDay,
        tz: timeZone,
        mood: normalized.mood,
        tags: [...normalized.tags],
      });
      showToast({ text: '已记下' });
      onSaved();
    } catch (saveError) {
      const notice = timelineSaveNotice(saveError);
      if (notice.refresh) onNotice(notice);
      else setError(notice.message);
    } finally {
      setSaving(false);
    }
  }

  const dayError = DAY.test(entryDay) && entryDay > today ? FUTURE_DAY_MESSAGE : null;

  return (
    <Stack gap="lg">
      <Text variant="heading" accessibilityRole="header">
        {seed ? '编辑日志' : '写日志'}
      </Text>
      <JournalField
        label="正文"
        value={body}
        onChangeText={setBody}
        count={body.length > 1800 ? `${body.length} / 2000` : null}
      />
      <Stack gap="sm">
        <Text variant="muted">日期</Text>
        <ChipGroup>
          {recent.map((day) => (
            <Chip
              key={day}
              label={day === today ? '今天' : day === shiftLocalDay(today, -1) ? '昨天' : formatMonthDay(day)}
              selected={entryDay === day}
              onPress={() => setEntryDay(day)}
            />
          ))}
        </ChipGroup>
        <Text variant="muted" accessibilityState={{ disabled: true }} accessibilityLabel={`不可选 ${futureLabel}`}>
          {futureLabel}
        </Text>
        <TextField
          label="其他日期"
          value={recent.includes(entryDay) ? '' : entryDay}
          onChangeText={setEntryDay}
          placeholder={today}
          helper="用 2026-10-26 这种格式。未来的日期不能选。"
          error={dayError}
        />
      </Stack>
      <Stack gap="sm">
        <Text variant="muted">心情</Text>
        <ChipGroup>
          {MOOD_LABELS.map((label, index) => {
            const value = index + 1;
            return (
              <Chip
                key={label}
                label={label}
                selected={mood === value}
                onPress={() => setMood(mood === value ? null : value)}
              />
            );
          })}
        </ChipGroup>
      </Stack>
      <Stack gap="sm">
        <TextField label="标签" value={tagDraft} onChangeText={setTagDraft} placeholder="1 到 20 字" />
        <Button label="添加" variant="secondary" onPress={addTag} disabled={saving} />
        {tags.map((tag) => (
          <Row key={tag} justify="between">
            <Text variant="body">{tag}</Text>
            <Button
              label="移除"
              variant="ghost"
              onPress={() => setTags(tags.filter((item) => item !== tag))}
              disabled={saving}
            />
          </Row>
        ))}
      </Stack>
      {error ? (
        <Text variant="body" tone="danger">
          {error}
        </Text>
      ) : null}
      <Row justify="end">
        <Button label="关闭" variant="secondary" onPress={onClose} disabled={saving} />
        <Button label="保存" onPress={() => void onSave()} loading={saving} />
      </Row>
    </Stack>
  );
}
