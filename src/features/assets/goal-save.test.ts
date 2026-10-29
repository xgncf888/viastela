import { expect, test } from '@jest/globals';

import { claimSave, commitGoalSave, releaseSave } from './goal-save';

test('a saved goal closes and toasts before the reload finishes', async () => {
  const order: string[] = [];
  let release: () => void = () => undefined;
  const reload = new Promise<void>((resolve) => {
    release = () => {
      order.push('reload-finished');
      resolve();
    };
  });
  const message = await commitGoalSave({
    write: async () => {
      order.push('write');
    },
    close: () => order.push('close'),
    toast: (text) => order.push(text),
    reload: () => {
      order.push('reload-started');
      return reload;
    },
  });
  expect(message).toBeNull();
  expect(order).toEqual(['write', 'close', '目标已更新', 'reload-started']);
  release();
  await reload;
  expect(order).toEqual(['write', 'close', '目标已更新', 'reload-started', 'reload-finished']);
});

test('a failed goal write does not close, toast, or reload', async () => {
  const calls: string[] = [];
  const message = await commitGoalSave({
    write: async () => {
      calls.push('write');
      throw new Error('offline');
    },
    close: () => calls.push('close'),
    toast: () => calls.push('toast'),
    reload: () => {
      calls.push('reload');
    },
  });
  expect(message).toBe('保存失败，请重试');
  expect(calls).toEqual(['write']);
});

test('a click claims the save once until it is released', () => {
  const gate = { current: false };
  expect(claimSave(gate)).toBe(true);
  expect(claimSave(gate)).toBe(false);
  releaseSave(gate);
  expect(claimSave(gate)).toBe(true);
});
