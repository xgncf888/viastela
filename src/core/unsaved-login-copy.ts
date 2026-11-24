/** Today banner when a save could not reach the cloud. */
export const SESSION_EXPIRED_BANNER = '登录已过期，记录还没保存';
export const SESSION_EXPIRED_ACTION = '重新登录';

/** Shown before Google or GitHub leaves the page with unsaved rows still in memory. */
export const OAUTH_UNSAVED_BODY =
  '用 Google 或 GitHub 登录会离开当前页面，回来后这些记录需要重新填写。用邮箱验证码登录可以保留它们。';
export const OAUTH_UNSAVED_PROCEED = '去登录';
export const OAUTH_UNSAVED_CANCEL = '取消';

export function unsavedOAuthTitle(count: number): string {
  return `还有 ${count} 条记录没保存`;
}

export function unsavedRecordCount(groups: readonly ReadonlySet<string>[]): number {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const id of group) ids.add(id);
  }
  return ids.size;
}
