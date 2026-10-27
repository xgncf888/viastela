import { expect, test } from '@jest/globals';

import { showProviderSignIn } from './provider-sign-in';

test('provider sign-in buttons show only on web', () => {
  expect(showProviderSignIn('ios')).toBe(false);
  expect(showProviderSignIn('android')).toBe(false);
  expect(showProviderSignIn('web')).toBe(true);
});
