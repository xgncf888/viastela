import { expect, test } from '@jest/globals';

import {
  accountDeletionPhrase,
  backupPurgeDays,
  deletionFacts,
  privacyContactEmail,
  privacyParagraphs,
  privacyUpdatedLabel,
} from './account-policy';

test('privacy copy names the stored data, sign-in methods, purge window, and contact', () => {
  const text = privacyParagraphs('生活记录').join('\n');
  expect(text).toContain('个人资料');
  expect(text).toContain('体重记录');
  expect(text).toContain('邮箱验证码');
  expect(text).toContain('Google');
  expect(text).toContain('GitHub');
  expect(text).toContain(String(backupPurgeDays));
  expect(text).toContain(privacyContactEmail);
  expect(privacyContactEmail).toBe('xgncf888@gmail.com');
  expect(privacyUpdatedLabel()).toBe('更新日期：2026年10月27日');
});

test('deletion facts list weight records, the profile, the undo warning, and the purge window', () => {
  const text = deletionFacts().join('\n');
  expect(text).toContain('体重记录');
  expect(text).toContain('个人资料');
  expect(text).toContain('不能恢复');
  expect(text).toContain(`${backupPurgeDays} 天`);
  expect(text).toContain(privacyContactEmail);
  expect(accountDeletionPhrase).toBe('删除');
});
