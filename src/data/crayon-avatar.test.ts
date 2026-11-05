import { beforeEach, expect, test } from '@jest/globals';

import { CRAYON_AVATAR_STORAGE_KEY, readCrayonAvatar, writeCrayonAvatar } from './crayon-avatar';
import { createMemoryLocalStore, localStore, setLocalStoreForTests } from './local-store';

beforeEach(() => {
  setLocalStoreForTests(createMemoryLocalStore());
});

test('crayon avatar defaults to the cat-ear portrait and stays on this device', async () => {
  await expect(readCrayonAvatar()).resolves.toBe('11-cat-ear-yellow');
  await writeCrayonAvatar('16-coder-boy');
  await expect(readCrayonAvatar()).resolves.toBe('16-coder-boy');
  const store = await localStore();
  await expect(store.getItem(CRAYON_AVATAR_STORAGE_KEY)).resolves.toBe('16-coder-boy');
  await store.setItem(CRAYON_AVATAR_STORAGE_KEY, '21-treasure-chest');
  await expect(readCrayonAvatar()).resolves.toBe('11-cat-ear-yellow');
});
