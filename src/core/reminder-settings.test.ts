import { describe, expect, it } from '@jest/globals';

import {
  DEFAULT_MONTH_END_TIME,
  DEFAULT_TRAINING_TIME,
  emptyReminderDraft,
  normalizeClock,
  normalizeTrainingDays,
  pickSubscription,
  planToggle,
  postgresTime,
  REMINDER_COPY,
  reminderNote,
  reminderNoteCopy,
  remindersCardVisible,
  reminderSwitchesEnabled,
  scheduleFieldsVisible,
  shouldSoftDeleteForPermission,
  toggleTrainingDay,
  withFlag,
} from './reminder-settings';

const openBrowser = {
  vapidConfigured: true,
  ios: false,
  standalone: false,
  pushSupported: true,
  permission: 'default' as const,
};

describe('reminder settings', () => {
  it('asks for permission only when a switch is turned on', () => {
    expect(planToggle({ flag: 'training', turnOn: false, note: null, permission: 'default' })).toEqual({
      type: 'turn-off',
      flag: 'training',
    });
    expect(planToggle({ flag: 'training', turnOn: true, note: null, permission: 'default' })).toEqual({
      type: 'turn-on',
      flag: 'training',
      requestPermission: true,
    });
    expect(planToggle({ flag: 'month_end', turnOn: true, note: null, permission: 'granted' })).toEqual({
      type: 'turn-on',
      flag: 'month_end',
      requestPermission: false,
    });
  });

  it('shows one note, with unconfigured ahead of iOS install ahead of a denied permission', () => {
    expect(reminderNote({ ...openBrowser, vapidConfigured: false, ios: true, permission: 'denied' })).toBe(
      'unconfigured',
    );
    expect(reminderNote({ ...openBrowser, ios: true, standalone: false, permission: 'denied' })).toBe('ios-install');
    expect(reminderNote({ ...openBrowser, ios: true, standalone: true, permission: 'denied' })).toBe(
      'permission-denied',
    );
    expect(reminderNote(openBrowser)).toBeNull();
    expect(reminderNote({ ...openBrowser, pushSupported: false })).toBe('unsupported');
    expect(reminderNoteCopy('unconfigured')).toBe(REMINDER_COPY.unconfigured);
    expect(reminderNoteCopy('ios-install')).toBe(REMINDER_COPY.iosInstall);
    expect(reminderNoteCopy('permission-denied')).toBe(REMINDER_COPY.permissionDenied);
    expect(reminderNoteCopy('unsupported')).toBe(REMINDER_COPY.unsupported);
    expect(reminderNoteCopy(null)).toBeNull();
  });

  it('disables the switches for an unconfigured key, iOS outside the home screen, and unsupported browsers', () => {
    expect(reminderSwitchesEnabled('unconfigured')).toBe(false);
    expect(reminderSwitchesEnabled('ios-install')).toBe(false);
    expect(reminderSwitchesEnabled('unsupported')).toBe(false);
    expect(reminderSwitchesEnabled('permission-denied')).toBe(true);
    expect(planToggle({ flag: 'training', turnOn: true, note: 'unconfigured', permission: 'default' })).toEqual({
      type: 'ignore',
    });
    expect(planToggle({ flag: 'month_end', turnOn: true, note: 'ios-install', permission: 'default' })).toEqual({
      type: 'ignore',
    });
    expect(planToggle({ flag: 'training', turnOn: true, note: 'permission-denied', permission: 'denied' })).toEqual({
      type: 'denied',
    });
  });

  it('keeps the chosen weekdays when training is turned off and on', () => {
    const picked = toggleTrainingDay(toggleTrainingDay([], 1), 3);
    expect(picked).toEqual([1, 3]);
    const on = withFlag({ ...emptyReminderDraft(), trainingDays: picked }, 'training', true);
    const off = withFlag(on, 'training', false);
    const again = withFlag(off, 'training', true);
    expect(off.trainingEnabled).toBe(false);
    expect(off.trainingDays).toEqual([1, 3]);
    expect(again.trainingDays).toEqual([1, 3]);
    expect(again.monthEndEnabled).toBe(false);
    expect(withFlag(again, 'month_end', true).trainingEnabled).toBe(true);
  });

  it('rejects weekdays outside 1 to 7 and keeps the two clocks independent', () => {
    expect(normalizeTrainingDays([0, 1, 1, 7, 8, 3.5])).toEqual([1, 7]);
    expect(toggleTrainingDay([1], 1)).toEqual([]);
    expect(emptyReminderDraft().trainingTime).toBe(DEFAULT_TRAINING_TIME);
    expect(emptyReminderDraft().monthEndTime).toBe(DEFAULT_MONTH_END_TIME);
    expect(normalizeClock('08:00')).toBe('08:00');
    expect(normalizeClock('21:30:00')).toBe('21:30');
    expect(normalizeClock('24:00')).toBeNull();
    expect(postgresTime('08:00')).toBe('08:00:00');
    expect(remindersCardVisible({ vapidConfigured: false, pushSupported: true })).toBe(false);
    expect(remindersCardVisible({ vapidConfigured: true, pushSupported: false })).toBe(false);
    expect(remindersCardVisible({ vapidConfigured: false, pushSupported: false })).toBe(false);
    expect(remindersCardVisible({ vapidConfigured: true, pushSupported: true })).toBe(true);
    expect(scheduleFieldsVisible(false)).toBe(false);
    expect(scheduleFieldsVisible(true)).toBe(true);
  });

  it('soft-deletes the live row when permission is revoked and keeps the other device', () => {
    expect(shouldSoftDeleteForPermission(true, 'denied')).toBe(true);
    expect(shouldSoftDeleteForPermission(false, 'denied')).toBe(false);
    expect(shouldSoftDeleteForPermission(true, 'granted')).toBe(false);
    const rows = [
      { id: 'this-device', endpoint: 'https://push.example.test/this' },
      { id: 'other-device', endpoint: 'https://push.example.test/other' },
    ];
    expect(pickSubscription(rows, { endpoint: 'https://push.example.test/this', id: 'other-device' })?.id).toBe(
      'this-device',
    );
    expect(pickSubscription(rows, { endpoint: null, id: 'other-device' })?.id).toBe('other-device');
    expect(pickSubscription(rows, { endpoint: null, id: null })).toBeNull();
  });
});
