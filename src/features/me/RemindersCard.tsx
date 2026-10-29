import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { currentTimeZone } from '@/core/local-day';
import {
  emptyReminderDraft,
  pickSubscription,
  planToggle,
  REMINDER_COPY,
  reminderNote,
  reminderNoteCopy,
  remindersCardVisible,
  reminderSwitchesEnabled,
  scheduleFieldsVisible,
  shouldSoftDeleteForPermission,
  toggleTrainingDay,
  TRAINING_WEEKDAYS,
  withFlag,
  type ReminderDraft,
  type ReminderFlag,
  type ReminderPermission,
} from '@/core/reminder-settings';
import {
  listPushSubscriptions,
  newSubscriptionId,
  softDeletePushSubscription,
  upsertPushSubscription,
} from '@/data/push-subscriptions';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { ChipGroup } from '@/ui/ChipGroup';
import { Stack } from '@/ui/layout';
import { Switch } from '@/ui/Switch';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { showToast } from '@/ui/toast';

import {
  applyLocalSchedule,
  clearSubscriptionId,
  readLocalSchedule,
  readSubscriptionId,
  writeLocalSchedule,
  writeSubscriptionId,
} from './reminder-storage';
import { currentEndpoint, readBrowserEnv, readVapidPublicKey, requestBrowserPermission, subscribePush } from './web-push';

export function RemindersCard() {
  if (Platform.OS !== 'web') return null;
  return <RemindersCardWeb />;
}

function RemindersCardWeb() {
  const [draft, setDraft] = useState<ReminderDraft>(() => emptyReminderDraft());
  const [ready, setReady] = useState(false);
  const [permission, setPermission] = useState<ReminderPermission>(() => readBrowserEnv().permission);
  const [busy, setBusy] = useState(false);
  const draftRef = useRef(draft);
  const env = readBrowserEnv();
  const visible = remindersCardVisible(env);
  const note = reminderNote({ ...env, permission });
  const switchesEnabled = reminderSwitchesEnabled(note) && ready && !busy;
  const copy = reminderNoteCopy(note);

  useEffect(() => {
    if (!visible) return;
    let cancel = false;
    const browser = readBrowserEnv();
    void (async () => {
      let next = applyLocalSchedule(emptyReminderDraft(currentTimeZone()), readLocalSchedule());
      try {
        const rows = await listPushSubscriptions();
        if (cancel) return;
        const endpoint = browser.permission === 'granted' ? await currentEndpoint() : null;
        const row = pickSubscription(rows, { endpoint, id: readSubscriptionId() });
        if (row?.id) writeSubscriptionId(row.id);
        if (row?.id && shouldSoftDeleteForPermission(true, browser.permission)) {
          await softDeletePushSubscription(row.id);
          clearSubscriptionId();
          next = {
            ...row,
            id: null,
            endpoint: null,
            p256dh: null,
            auth: null,
            trainingEnabled: false,
            monthEndEnabled: false,
          };
        } else if (row) {
          next = row;
        }
      } catch {
        if (!cancel) showToast({ text: REMINDER_COPY.saveFailed });
      }
      if (cancel) return;
      writeLocalSchedule(next);
      draftRef.current = next;
      setDraft(next);
      setReady(true);
    })();
    return () => {
      cancel = true;
    };
  }, [visible]);

  async function persist(next: ReminderDraft): Promise<void> {
    const saved = { ...next, tz: currentTimeZone() };
    draftRef.current = saved;
    setDraft(saved);
    writeLocalSchedule(saved);
    if (!saved.id || !saved.endpoint || !saved.p256dh || !saved.auth) return;
    await upsertPushSubscription(saved);
    writeSubscriptionId(saved.id);
  }

  async function onToggle(flag: ReminderFlag, turnOn: boolean) {
    const browser = readBrowserEnv();
    setPermission(browser.permission);
    const plan = planToggle({ flag, turnOn, note: reminderNote(browser), permission: browser.permission });
    if (plan.type === 'ignore' || plan.type === 'denied') return;
    if (plan.type === 'turn-off') {
      try {
        await persist(withFlag(draftRef.current, flag, false));
      } catch {
        showToast({ text: REMINDER_COPY.saveFailed });
      }
      return;
    }
    setBusy(true);
    try {
      let allowed = browser.permission;
      if (plan.requestPermission) {
        allowed = await requestBrowserPermission();
        setPermission(allowed);
        if (allowed !== 'granted') return;
      }
      const vapid = readVapidPublicKey();
      if (!vapid) return;
      const keys = await subscribePush(vapid);
      const next = withFlag(
        {
          ...draftRef.current,
          id: draftRef.current.id ?? readSubscriptionId() ?? newSubscriptionId(),
          endpoint: keys.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          tz: currentTimeZone(),
        },
        flag,
        true,
      );
      await persist(next);
    } catch {
      showToast({ text: REMINDER_COPY.saveFailed });
    } finally {
      setBusy(false);
    }
  }

  async function onDays(day: number) {
    try {
      await persist({ ...draftRef.current, trainingDays: toggleTrainingDay(draftRef.current.trainingDays, day) });
    } catch {
      showToast({ text: REMINDER_COPY.saveFailed });
    }
  }

  function onTime(flag: ReminderFlag, value: string) {
    const next =
      flag === 'training'
        ? { ...draftRef.current, trainingTime: value }
        : { ...draftRef.current, monthEndTime: value };
    draftRef.current = next;
    setDraft(next);
    if (!/^\d{2}:\d{2}$/.test(value)) return;
    void persist(next).catch(() => showToast({ text: REMINDER_COPY.saveFailed }));
  }

  const showTraining = scheduleFieldsVisible(draft.trainingEnabled);
  const showMonthEnd = scheduleFieldsVisible(draft.monthEndEnabled);

  if (!visible) return null;

  return (
    <Card>
      <Text variant="heading">{REMINDER_COPY.section}</Text>
      {!ready ? <Text variant="body">读取中</Text> : null}
      <Switch
        label={REMINDER_COPY.training}
        value={draft.trainingEnabled}
        disabled={!switchesEnabled}
        onValueChange={(value) => void onToggle('training', value)}
      />
      {showTraining ? (
        <Stack gap="sm">
          <Text variant="muted">{REMINDER_COPY.weekdayHelp}</Text>
          <ChipGroup>
            {TRAINING_WEEKDAYS.map((weekday) => (
              <Chip
                key={weekday.day}
                label={weekday.label}
                selected={draft.trainingDays.includes(weekday.day)}
                onPress={() => void onDays(weekday.day)}
              />
            ))}
          </ChipGroup>
          <TextField
            label={REMINDER_COPY.trainingTime}
            value={draft.trainingTime}
            onChangeText={(value) => onTime('training', value)}
            placeholder="08:00"
            helper={REMINDER_COPY.trainingTimeHelp}
          />
        </Stack>
      ) : null}
      <Switch
        label={REMINDER_COPY.monthEnd}
        value={draft.monthEndEnabled}
        disabled={!switchesEnabled}
        onValueChange={(value) => void onToggle('month_end', value)}
      />
      {showMonthEnd ? (
        <TextField
          label={REMINDER_COPY.monthEndTime}
          value={draft.monthEndTime}
          onChangeText={(value) => onTime('month_end', value)}
          placeholder="21:30"
          helper={REMINDER_COPY.monthEndTimeHelp}
        />
      ) : null}
      {copy ? <Text variant="muted">{copy}</Text> : null}
    </Card>
  );
}
