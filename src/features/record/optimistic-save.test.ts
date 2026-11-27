import '@/ui/test-dom';

import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { act, createContext, createElement, useEffect, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { balanceUpdatedThisMonth } from '@/data/account-balances';
import { NOT_SIGNED_IN, requireRemoteUserId } from '@/data/auth';
import { getDaySwitch } from '@/data/profile';
import { listRecentTopics, listStudyRecords, upsertStudyRecord } from '@/data/study';
import { listRecentExercises, listTrainingSets, upsertTrainingSet } from '@/data/training';
import { latestWeightRecord, listWeightRecords, upsertWeightRecord } from '@/data/weights';
import { StudyProvider, useStudy } from '@/features/study/StudyProvider';
import { TrainingProvider, useTraining } from '@/features/training/TrainingProvider';
import { TodayScreen } from '@/features/today/TodayScreen';
import { WeightProvider, useWeight } from '@/features/weight/WeightProvider';
import { Button } from '@/ui/Button';
import { showToast } from '@/ui/toast';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: unknown }) => children ?? null,
  SafeAreaProvider: ({ children }: { children?: unknown }) => children ?? null,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const web = require('react-native-web') as typeof import('react-native');
  return web;
});

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  usePathname: () => '/',
  useFocusEffect: () => undefined,
}));

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const EXPIRED_BANNER = '登录已过期，记录还没保存';
const liveAuth: { userId: string | null; needsReauth: boolean } = {
  userId: USER_A,
  needsReauth: false,
};

jest.mock('@/data/auth', () => {
  const actual = jest.requireActual('@/data/auth') as typeof import('@/data/auth');
  return {
    ...actual,
    requireRemoteUserId: jest.fn(async () => {
      if (!liveAuth.userId) throw new Error(actual.NOT_SIGNED_IN);
      return liveAuth.userId;
    }),
  };
});

type LiveAuthValue = {
  ready: boolean;
  session: { userId: string; email: string } | null;
  needsReauth: boolean;
  holdApp: boolean;
  requestLogin: () => void;
};

const LiveAuthContext = createContext<LiveAuthValue | null>(null);

jest.mock('@/features/auth/AuthProvider', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof import('react');
  return {
    useAuth: () => {
      const value = React.useContext(LiveAuthContext);
      if (value) return value;
      return {
        ready: true,
        session: liveAuth.userId ? { userId: liveAuth.userId, email: 'reader@example.com' } : null,
        needsReauth: liveAuth.needsReauth,
        holdApp: false,
        requestLogin: () => undefined,
      };
    },
  };
});

jest.mock('@/features/shell/AppShell', () => ({
  useShellInset: () => 0,
}));

jest.mock('@/features/record/deferred-delete', () => {
  const ids = new Set<string>();
  return {
    useDeferredDeleteIds: () => ids,
    scheduleDeferredDelete: jest.fn(),
    cancelDeferredDeletes: jest.fn(),
    installDeferredDeleteLifecycle: () => () => undefined,
  };
});

jest.mock('@/data/profile', () => ({ getDaySwitch: jest.fn(), updateDaySwitch: jest.fn() }));
jest.mock('@/data/weights', () => ({
  listWeightRecords: jest.fn(),
  latestWeightRecord: jest.fn(),
  upsertWeightRecord: jest.fn(),
  softDeleteWeightRecord: jest.fn(),
}));
jest.mock('@/data/training', () => ({
  listTrainingSets: jest.fn(),
  listRecentExercises: jest.fn(),
  upsertTrainingSet: jest.fn(),
  softDeleteTrainingSet: jest.fn(),
}));
jest.mock('@/data/study', () => ({
  listStudyRecords: jest.fn(),
  listRecentTopics: jest.fn(),
  upsertStudyRecord: jest.fn(),
  softDeleteStudyRecord: jest.fn(),
}));
jest.mock('@/data/account-balances', () => ({
  balanceUpdatedThisMonth: jest.fn(),
}));
jest.mock('@/ui/toast', () => ({
  showToast: jest.fn(),
  dismissShownToast: jest.fn(),
  ToastHost: () => null,
}));

const listWeightRecordsMock = jest.mocked(listWeightRecords);
const latestWeightRecordMock = jest.mocked(latestWeightRecord);
const upsertWeightRecordMock = jest.mocked(upsertWeightRecord);
const listTrainingSetsMock = jest.mocked(listTrainingSets);
const listRecentExercisesMock = jest.mocked(listRecentExercises);
const upsertTrainingSetMock = jest.mocked(upsertTrainingSet);
const listStudyRecordsMock = jest.mocked(listStudyRecords);
const listRecentTopicsMock = jest.mocked(listRecentTopics);
const upsertStudyRecordMock = jest.mocked(upsertStudyRecord);
const getDaySwitchMock = jest.mocked(getDaySwitch);
const balanceUpdatedThisMonthMock = jest.mocked(balanceUpdatedThisMonth);
const requireRemoteUserIdMock = jest.mocked(requireRemoteUserId);
const showToastMock = jest.mocked(showToast);

const roots: Root[] = [];
const windowListeners = new Map<string, Set<(event: Event) => void>>();

function installWindowEvents() {
  windowListeners.clear();
  globalThis.addEventListener = ((type: string, listener: (event: Event) => void) => {
    const bucket = windowListeners.get(type) ?? new Set<(event: Event) => void>();
    bucket.add(listener);
    windowListeners.set(type, bucket);
  }) as typeof globalThis.addEventListener;
  globalThis.removeEventListener = ((type: string, listener: (event: Event) => void) => {
    windowListeners.get(type)?.delete(listener);
  }) as typeof globalThis.removeEventListener;
}

function dispatchWindow(type: string) {
  const event = { type } as Event;
  windowListeners.get(type)?.forEach((listener) => listener(event));
}

function mount(node: ReactNode): HTMLElement {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  roots.push(root);
  return container;
}

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function deferred() {
  let resolve: () => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let saveWeight: (kg: number, id?: string) => Promise<unknown> = async () => undefined;
let retryWeight: (id: string) => Promise<void> = async () => undefined;
let saveSet: ReturnType<typeof useTraining>['saveSet'] = async () => 'retry';
let saveStudy: ReturnType<typeof useStudy>['saveRecord'] = async () => 'retry';
let refreshAuth: () => void = () => undefined;
const weightSnap = { failed: 0, weights: [] as number[], ids: [] as string[] };

function FailedRow({ label, failed, onRetry }: { label: string; failed: boolean; onRetry: () => void }) {
  return createElement(
    'div',
    null,
    createElement('span', null, label),
    failed
      ? createElement(
          'div',
          null,
          createElement('span', null, '未保存'),
          createElement(Button, { label: '重试', onPress: onRetry }),
        )
      : null,
  );
}

function Probe() {
  const weight = useWeight();
  const training = useTraining();
  const study = useStudy();
  useEffect(() => {
    saveWeight = weight.saveWeight;
    retryWeight = weight.retry;
    saveSet = training.saveSet;
    saveStudy = study.saveRecord;
    weightSnap.failed = weight.failedIds.size;
    weightSnap.weights = weight.records.map((record) => record.weightKg);
    weightSnap.ids = weight.records.map((record) => record.id);
  });
  return createElement(
    'div',
    null,
    createElement(TodayScreen),
    weight.records.map((record) =>
      createElement(FailedRow, {
        key: record.id,
        label: String(record.weightKg),
        failed: weight.failedIds.has(record.id),
        onRetry: () => void weight.retry(record.id),
      }),
    ),
    training.sets.map((set) =>
      createElement(FailedRow, {
        key: set.id,
        label: set.exercise,
        failed: training.failedIds.has(set.id),
        onRetry: () => void training.retry(set.id),
      }),
    ),
    study.records.map((record) =>
      createElement(FailedRow, {
        key: record.id,
        label: record.topic,
        failed: study.failedIds.has(record.id),
        onRetry: () => void study.retry(record.id),
      }),
    ),
  );
}

function AuthFrame({ children }: { children?: ReactNode }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    refreshAuth = () => setTick((current) => current + 1);
    return () => {
      refreshAuth = () => undefined;
    };
  }, []);
  const value: LiveAuthValue = {
    ready: true,
    session: liveAuth.userId ? { userId: liveAuth.userId, email: 'reader@example.com' } : null,
    needsReauth: liveAuth.needsReauth,
    holdApp: false,
    requestLogin: () => undefined,
  };
  return createElement(LiveAuthContext.Provider, { value }, children);
}

function Harness() {
  return createElement(
    AuthFrame,
    null,
    createElement(WeightProvider, null, createElement(TrainingProvider, null, createElement(StudyProvider, null, createElement(Probe)))),
  );
}

function setAuth(userId: string | null, needsReauth: boolean) {
  liveAuth.userId = userId;
  liveAuth.needsReauth = needsReauth;
  act(() => refreshAuth());
}

beforeEach(() => {
  liveAuth.userId = USER_A;
  liveAuth.needsReauth = false;
  weightSnap.failed = 0;
  weightSnap.weights = [];
  weightSnap.ids = [];
  requireRemoteUserIdMock.mockReset();
  requireRemoteUserIdMock.mockImplementation(async () => {
    if (!liveAuth.userId) throw new Error(NOT_SIGNED_IN);
    return liveAuth.userId;
  });
  showToastMock.mockClear();
  installWindowEvents();
  getDaySwitchMock.mockReset();
  listWeightRecordsMock.mockReset();
  latestWeightRecordMock.mockReset();
  upsertWeightRecordMock.mockReset();
  listTrainingSetsMock.mockReset();
  listRecentExercisesMock.mockReset();
  upsertTrainingSetMock.mockReset();
  listStudyRecordsMock.mockReset();
  listRecentTopicsMock.mockReset();
  upsertStudyRecordMock.mockReset();
  balanceUpdatedThisMonthMock.mockReset();
  getDaySwitchMock.mockResolvedValue('04:00');
  listWeightRecordsMock.mockResolvedValue([]);
  latestWeightRecordMock.mockResolvedValue(null);
  listTrainingSetsMock.mockResolvedValue([]);
  listRecentExercisesMock.mockResolvedValue([]);
  listStudyRecordsMock.mockResolvedValue([]);
  listRecentTopicsMock.mockResolvedValue([]);
  balanceUpdatedThisMonthMock.mockResolvedValue(true);
  upsertWeightRecordMock.mockResolvedValue(undefined);
  upsertTrainingSetMock.mockResolvedValue(undefined);
  upsertStudyRecordMock.mockResolvedValue(undefined);
});

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    act(() => root?.unmount());
  }
});

test('a weight save shows the row before the write finishes and does not reload the list', async () => {
  const write = deferred();
  upsertWeightRecordMock.mockImplementation(() => write.promise);
  const view = mount(createElement(Harness));
  await flush();
  const lists = listWeightRecordsMock.mock.calls.length;
  expect(lists).toBeGreaterThan(0);

  await act(async () => {
    await saveWeight(76.4);
  });
  expect(view.textContent).toContain('76.4');
  expect(view.textContent).not.toContain('未保存');
  expect(listWeightRecordsMock.mock.calls.length).toBe(lists);
  expect(upsertWeightRecordMock).toHaveBeenCalledTimes(1);

  write.resolve();
  await flush();
  expect(view.textContent).toContain('76.4');
  expect(view.textContent).not.toContain('未保存');
  expect(listWeightRecordsMock.mock.calls.length).toBe(lists);
});

test('a failed weight save keeps the row and shows 未保存 · 重试', async () => {
  const write = deferred();
  upsertWeightRecordMock.mockImplementation(() => write.promise);
  const view = mount(createElement(Harness));
  await flush();
  const lists = listWeightRecordsMock.mock.calls.length;

  await act(async () => {
    await saveWeight(74.2);
  });
  expect(view.textContent).toContain('74.2');
  expect(listWeightRecordsMock.mock.calls.length).toBe(lists);

  await act(async () => {
    write.reject(new Error('network'));
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
  expect(view.textContent).toContain('未保存');
  expect(view.textContent).toContain('重试');
  expect(view.textContent).toContain('74.2');
  expect(listWeightRecordsMock.mock.calls.length).toBe(lists);
});

test('training and study saves show the new row before the write and mark 未保存 on failure', async () => {
  const trainingWrite = deferred();
  const studyWrite = deferred();
  upsertTrainingSetMock.mockImplementation(() => trainingWrite.promise);
  upsertStudyRecordMock.mockImplementation(() => studyWrite.promise);
  const view = mount(createElement(Harness));
  await flush();
  const trainingLists = listTrainingSetsMock.mock.calls.length;
  const studyLists = listStudyRecordsMock.mock.calls.length;

  await act(async () => {
    await saveSet({ exercise: '深蹲', reps: 8, weightKg: 40, bandLevel: null });
    await saveStudy({ topic: '英语', durationMinutes: 30, note: null });
  });
  expect(view.textContent).toContain('深蹲');
  expect(view.textContent).toContain('英语');
  expect(listTrainingSetsMock.mock.calls.length).toBe(trainingLists);
  expect(listStudyRecordsMock.mock.calls.length).toBe(studyLists);

  await act(async () => {
    trainingWrite.reject(new Error('network'));
    studyWrite.reject(new Error('network'));
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
  expect(view.textContent).toContain('未保存');
  expect(view.textContent).toContain('重试');
  expect(listTrainingSetsMock.mock.calls.length).toBe(trainingLists);
  expect(listStudyRecordsMock.mock.calls.length).toBe(studyLists);
});

async function leaveOneFailedWeight(view: HTMLElement) {
  requireRemoteUserIdMock.mockRejectedValueOnce(new Error(NOT_SIGNED_IN));
  await act(async () => {
    await saveWeight(72.4);
  });
  await flush();
  expect(view.textContent).toContain('72.4');
  expect(view.textContent).toContain('未保存');
  expect(weightSnap.failed).toBe(1);
  expect(upsertWeightRecordMock).not.toHaveBeenCalled();
}

function expectForeignAccountClear(view: HTMLElement) {
  expect(weightSnap.failed).toBe(0);
  expect(weightSnap.weights).toEqual([]);
  expect(view.textContent).not.toContain('未保存');
  expect(view.textContent).not.toContain(EXPIRED_BANNER);
  expect(view.textContent).not.toContain('72.4');
  expect(upsertWeightRecordMock).not.toHaveBeenCalled();
  expect(showToastMock).not.toHaveBeenCalled();
}

test('account A failed row is dropped after the session expires and B signs in', async () => {
  const view = mount(createElement(Harness));
  await flush();
  await leaveOneFailedWeight(view);

  setAuth(null, true);
  await flush();
  expect(view.textContent).toContain('72.4');
  expect(view.textContent).toContain('未保存');
  expect(view.textContent).toContain(EXPIRED_BANNER);
  expect(weightSnap.failed).toBe(1);

  const failedId = weightSnap.ids[0];
  setAuth(USER_B, true);
  await flush();
  expectForeignAccountClear(view);

  await act(async () => {
    await retryWeight(failedId);
    dispatchWindow('online');
  });
  await flush();
  expectForeignAccountClear(view);
});

test('account A failed row is dropped when the session switches directly to B', async () => {
  const view = mount(createElement(Harness));
  await flush();
  await leaveOneFailedWeight(view);
  setAuth(USER_A, true);
  await flush();
  expect(view.textContent).toContain(EXPIRED_BANNER);

  const failedId = weightSnap.ids[0];
  setAuth(USER_B, true);
  await flush();
  expectForeignAccountClear(view);

  await act(async () => {
    await retryWeight(failedId);
    dispatchWindow('online');
  });
  await flush();
  expectForeignAccountClear(view);
});

test('the same account writes a retried row exactly once after signing in again', async () => {
  const view = mount(createElement(Harness));
  await flush();
  await leaveOneFailedWeight(view);

  setAuth(null, true);
  await flush();
  expect(view.textContent).toContain('72.4');
  expect(view.textContent).toContain('未保存');
  expect(weightSnap.failed).toBe(1);

  setAuth(USER_A, false);
  await flush();
  expect(weightSnap.failed).toBe(1);
  expect(weightSnap.weights).toEqual([72.4]);
  expect(view.textContent).toContain('未保存');

  const failedId = weightSnap.ids[0];
  const write = deferred();
  upsertWeightRecordMock.mockImplementation(() => write.promise);
  await act(async () => {
    const first = retryWeight(failedId);
    const second = retryWeight(failedId);
    await Promise.all([first, second]);
  });
  expect(upsertWeightRecordMock).toHaveBeenCalledTimes(1);
  write.resolve();
  await flush();
  expect(upsertWeightRecordMock).toHaveBeenCalledTimes(1);
  expect(weightSnap.failed).toBe(0);
  expect(view.textContent).not.toContain('未保存');
  expect(view.textContent).toContain('72.4');
});

test('an in-flight retry is discarded when the live user changes before the write', async () => {
  const view = mount(createElement(Harness));
  await flush();
  await leaveOneFailedWeight(view);
  const failedId = weightSnap.ids[0];

  let releaseLive: (userId: string) => void = () => undefined;
  const live = new Promise<string>((resolve) => {
    releaseLive = resolve;
  });
  requireRemoteUserIdMock.mockImplementation(() => live);

  await act(async () => {
    void retryWeight(failedId);
    await Promise.resolve();
  });
  expect(upsertWeightRecordMock).not.toHaveBeenCalled();

  releaseLive(USER_B);
  await flush();
  expect(upsertWeightRecordMock).not.toHaveBeenCalled();
  expect(weightSnap.failed).toBe(0);
  expect(weightSnap.weights).toEqual([]);
  expect(view.textContent).not.toContain('未保存');
  expect(view.textContent).not.toContain('72.4');
  expect(showToastMock).not.toHaveBeenCalled();
});
