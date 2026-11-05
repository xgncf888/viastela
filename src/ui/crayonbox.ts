import {
  CRAYON_AVATAR_IDS,
  DEFAULT_CRAYON_AVATAR,
  type CrayonPortraitId,
} from '@/data/crayon-avatar';

/** Static crayon portraits in `public/crayonbox/`. The chest is an asset only, not a portrait. */

const PORTRAIT_LABELS: Record<CrayonPortraitId, string> = {
  '01-inventor-boy': '发明家',
  '03-tiny-knight': '小骑士',
  '06-librarian-boy': '图书管理员',
  '10-cyclist-boy': '骑行',
  '11-cat-ear-yellow': '猫耳',
  '16-coder-boy': '程序员',
  '17-explorer-girl': '探险家',
};

export const CRAYON_PORTRAITS = CRAYON_AVATAR_IDS.map((id) => ({
  id,
  file: `${id}.webp`,
  label: PORTRAIT_LABELS[id],
}));

export { DEFAULT_CRAYON_AVATAR, type CrayonPortraitId };

export const CRAYON_TODAY_EMPTY = '01-inventor-boy.webp';

export function crayonPortraitFile(id: CrayonPortraitId): string {
  return `${id}.webp`;
}

/** Absolute on http(s); relative inside the packaged `/assets/www/` webview. */
export function crayonboxUri(fileName: string): string {
  if (
    typeof window !== 'undefined' &&
    window.location?.pathname &&
    window.location.pathname.includes('/assets/www/')
  ) {
    return `./crayonbox/${fileName}`;
  }
  return `/crayonbox/${fileName}`;
}
