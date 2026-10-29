import { expect, test } from '@jest/globals';

import { tabNavigator } from './tab-navigator';

test('revisiting a tab does not detach the screen', () => {
  expect(tabNavigator.detachInactiveScreens).toBe(false);
  expect(tabNavigator.lazy).toBe(true);
});
