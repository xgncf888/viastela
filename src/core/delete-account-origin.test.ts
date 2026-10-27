import { expect, test } from '@jest/globals';

import {
  deleteAccountLocalOrigins,
  deleteAccountPreviewExample,
  deleteAccountProductionOrigin,
  isAllowedDeleteOrigin,
  parseAllowedOrigins,
} from './delete-account-origin';

const production = [deleteAccountProductionOrigin];

test('the production origin is allowed only when the env list includes it', () => {
  expect(isAllowedDeleteOrigin(deleteAccountProductionOrigin, production)).toBe(true);
  expect(isAllowedDeleteOrigin(deleteAccountProductionOrigin, [])).toBe(false);
  expect(parseAllowedOrigins(`${deleteAccountProductionOrigin}, *, , https://evil.example/path`)).toEqual([
    deleteAccountProductionOrigin,
  ]);
});

test('branch previews match the anchored pattern and per-commit URLs do not', () => {
  expect(isAllowedDeleteOrigin(deleteAccountPreviewExample, [])).toBe(true);
  expect(isAllowedDeleteOrigin('https://viastela-9f3a1c2-xgncf888.vercel.app', [])).toBe(false);
  expect(isAllowedDeleteOrigin('https://viastela-git-foo-xgncf888.vercel.app', [])).toBe(true);
  expect(isAllowedDeleteOrigin('https://viastela-git-foo-other.vercel.app', production)).toBe(false);
  expect(isAllowedDeleteOrigin('https://notviastela.vercel.app', production)).toBe(false);
  expect(isAllowedDeleteOrigin('http://viastela-git-foo-xgncf888.vercel.app', [])).toBe(false);
  expect(isAllowedDeleteOrigin('https://viastela-git-foo-xgncf888.vercel.app:443', [])).toBe(false);
  expect(isAllowedDeleteOrigin('https://viastela-git-foo-xgncf888.vercel.app.evil.example', [])).toBe(false);
  expect(isAllowedDeleteOrigin('https://evil.viastela-git-foo-xgncf888.vercel.app', [])).toBe(false);
  expect(isAllowedDeleteOrigin('https://viastela.vercel.app.evil.example', production)).toBe(false);
});

test('localhost is not a default and the literal null is rejected', () => {
  expect(isAllowedDeleteOrigin(deleteAccountLocalOrigins[0], production)).toBe(false);
  expect(isAllowedDeleteOrigin(deleteAccountLocalOrigins[1], production)).toBe(false);
  expect(isAllowedDeleteOrigin(deleteAccountLocalOrigins[0], deleteAccountLocalOrigins)).toBe(true);
  expect(isAllowedDeleteOrigin('null', production)).toBe(false);
  expect(isAllowedDeleteOrigin('*', ['*'])).toBe(false);
  expect(isAllowedDeleteOrigin('https://evil.example', ['*'])).toBe(false);
});
