import { expect, test } from '@jest/globals';

import {
  accountDeletionPhrase,
  backupPurgeDays,
  accountDeletedDetail,
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
  expect(text).toContain('显示名');
  expect(text).toContain('头像');
  expect(text).toContain('Google 或 GitHub 登录');
  expect(text).toContain('个人资料目前只有日切时间这一项设置。');
  expect(text).toContain('我们不出售数据，不展示广告，也不把你的数据发给任何人工智能服务。');
  expect(text).toContain('前提是每种登录方式给出的是同一个邮箱');
  expect(text).toContain('GitHub 的主邮箱');
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
  expect(deletion).toContain('显示名');
  expect(deletion).toContain('头像');
  expect(deletion).toContain('不能恢复');
  expect(deletion).toContain(privacyContactEmail);
  expect(accountDeletionPhrase).toBe('删除');
  expect(dayCounts(privacy)).toEqual([backupPurgeDays]);
  expect(dayCounts(deletion)).toEqual([backupPurgeDays]);
  expect(accountDeletedDetail()).toBe(`你的记录已从星途中删除，数据库备份会在 ${backupPurgeDays} 天内清除`);
  expect(dayCounts(accountDeletedDetail())).toEqual([backupPurgeDays]);
});
