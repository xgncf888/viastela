/** Longest published Supabase daily-backup retention (Enterprise). Revisit if PITR is longer. */
export const backupPurgeDays = 30;

/** Contact address for privacy questions. */
export const privacyContactEmail = 'xgncf888@gmail.com';

/** Civil date of the privacy policy text. */
export const privacyUpdatedOn = '2026-10-27';

/** The account-deletion field must match this phrase before the button enables. */
export const accountDeletionPhrase = '删除';

export function privacyUpdatedLabel(isoDate = privacyUpdatedOn): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error('privacy date must be YYYY-MM-DD');
  return `更新日期：${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`;
}

export function privacyParagraphs(displayName: string): readonly string[] {
  return [
    `${displayName} 保存体重、训练组、学习记录，以及账号的邮箱、名字和头像。`,
    '我们不出售数据。',
    '我们不把数据用于广告。',
    '这一版不会把数据发给任何人工智能服务。',
    '登录方式有邮箱验证码、Google 和 GitHub。同一个已验证邮箱是同一个账号，换一种登录方式不会拆开原来的记录。',
    '你可以删除账号。删除会去掉该账号的体重、训练组、学习记录，以及邮箱、名字和头像，而且不能恢复。',
    `托管数据库里的备份会在 ${backupPurgeDays} 天内清除。在这之前，备份中可能仍有已删除的数据。`,
    `联系邮箱：${privacyContactEmail}`,
  ];
}

export function deletionFacts(): readonly string[] {
  return [
    '将删除你的体重记录。',
    '将删除你的训练组。',
    '将删除你的学习记录。',
    '将删除你的个人资料，包括邮箱、名字和头像。',
    '删除后不能恢复。',
    `数据库备份会在 ${backupPurgeDays} 天内清除。`,
    `如需联系，请发邮件到 ${privacyContactEmail}。`,
  ];
}
