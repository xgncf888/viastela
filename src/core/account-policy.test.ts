import { expect, test } from '@jest/globals';

import {
  accountDeletionPhrase,
  backupPurgeDays,
  deletionFacts,
  privacyContactEmail,
  privacyParagraphs,
  privacyUpdatedLabel,
} from './account-policy';

function dayCounts(text: string): number[] {
  return [...text.matchAll(/(\d+)\s*天/g)].map((match) => Number(match[1]));
}

test('privacy copy names the stored data, the limits on its use, and the contact', () => {
  const text = privacyParagraphs('生活记录').join('\n');
  expect(text).toContain('体重');
  expect(text).toContain('训练组');
  expect(text).toContain('学习记录');
  expect(text).toContain('邮箱');
  expect(text).toContain('名字');
  expect(text).toContain('头像');
  expect(text).toContain('我们不出售数据。');
  expect(text).toContain('我们不把数据用于广告。');
  expect(text).toContain('这一版不会把数据发给任何人工智能服务。');
  expect(text).toContain('邮箱验证码');
  expect(text).toContain('Google');
  expect(text).toContain('GitHub');
  expect(text).toContain(privacyContactEmail);
  expect(privacyContactEmail).toBe('xgncf888@gmail.com');
  expect(privacyUpdatedLabel()).toBe('更新日期：2026年10月27日');
});

test('deletion facts list weight, training, study, the profile, and the same purge window', () => {
  const privacy = privacyParagraphs('生活记录').join('\n');
  const deletion = deletionFacts().join('\n');
  expect(deletion).toContain('体重记录');
  expect(deletion).toContain('训练组');
  expect(deletion).toContain('学习记录');
  expect(deletion).toContain('个人资料');
  expect(deletion).toContain('邮箱');
  expect(deletion).toContain('名字');
  expect(deletion).toContain('头像');
  expect(deletion).toContain('不能恢复');
  expect(deletion).toContain(privacyContactEmail);
  expect(accountDeletionPhrase).toBe('删除');
  expect(dayCounts(privacy)).toEqual([backupPurgeDays]);
  expect(dayCounts(deletion)).toEqual([backupPurgeDays]);
});
