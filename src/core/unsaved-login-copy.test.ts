import { expect, test } from '@jest/globals';

import { unsavedOAuthTitle, unsavedRecordCount } from './unsaved-login-copy';

test('oauth unsaved title uses the same sentence for every count', () => {
  expect(unsavedOAuthTitle(1)).toBe('还有 1 条记录没保存');
  expect(unsavedOAuthTitle(3)).toBe('还有 3 条记录没保存');
});

test('unsaved count unions record ids', () => {
  expect(unsavedRecordCount([new Set(['a']), new Set(['b', 'a']), new Set(['c'])])).toBe(3);
  expect(unsavedRecordCount([])).toBe(0);
});
