import { beforeEach, expect, test } from '@jest/globals';

import { readAmountMasked, writeAmountMasked } from './amount-mask';
import { createMemoryLocalStore, setLocalStoreForTests } from './local-store';

beforeEach(() => {
  setLocalStoreForTests(createMemoryLocalStore());
});

test('amounts are hidden until this user turns the mask off', async () => {
  await expect(readAmountMasked('user-a')).resolves.toBe(true);
  await writeAmountMasked('user-a', false);
  await expect(readAmountMasked('user-a')).resolves.toBe(false);
  await expect(readAmountMasked('user-b')).resolves.toBe(true);
});
