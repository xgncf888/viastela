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
    `${displayName} 目前保存个人资料和体重记录。`,
    '个人资料是日界时间，以及它所属的账号。',
    '体重记录包括体重、记录时间、当时的时区、归属日、更新时间和删除时间。',
    '登录方式有邮箱验证码、Google 和 GitHub。同一个已验证邮箱是同一个账号，换一种登录方式不会拆开原来的记录。',
    '你可以删除账号。删除会去掉该账号的个人资料和体重记录，而且不能恢复。',
    `托管数据库里的备份会在 ${backupPurgeDays} 天内清除。在这之前，备份中可能仍有已删除的数据。`,
    `联系邮箱：${privacyContactEmail}`,
  ];
}

export function deletionFacts(): readonly string[] {
  return [
    '将删除你的体重记录。',
    '将删除你的个人资料。',
    '删除后不能恢复。',
    `数据库备份会在 ${backupPurgeDays} 天内清除。`,
    `如需联系，请发邮件到 ${privacyContactEmail}。`,
  ];
}
