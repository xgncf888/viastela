import { expect, test } from '@jest/globals';

import { oauthRedirectTo } from './oauth';

test('web OAuth returns to the current origin and native does not invent one', () => {
  expect(oauthRedirectTo('https://app.example')).toBe('https://app.example');
  expect(oauthRedirectTo(null)).toBeUndefined();
  expect(oauthRedirectTo(undefined)).toBeUndefined();
  expect(oauthRedirectTo('')).toBeUndefined();
});
