import { expect, jest, test } from '@jest/globals';
import { act } from 'react';

import { createNavPress } from './nav-press';

test('a cancelled pointer press does not swallow the next keyboard activation', async () => {
  const go = jest.fn();
  const nav = createNavPress();
  nav.pressIn(go);
  expect(go).toHaveBeenCalledTimes(1);
  nav.cancel();
  await act(async () => {
    await Promise.resolve();
  });
  nav.press(go);
  expect(go).toHaveBeenCalledTimes(2);
});

test('the click after press-in does not navigate a second time', async () => {
  const go = jest.fn();
  const nav = createNavPress();
  nav.pressIn(go);
  nav.cancel();
  nav.press(go);
  expect(go).toHaveBeenCalledTimes(1);
  await act(async () => {
    await Promise.resolve();
  });
  nav.press(go);
  expect(go).toHaveBeenCalledTimes(2);
});
