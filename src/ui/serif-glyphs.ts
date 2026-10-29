/**
 * The only list of web serif glyphs (DESIGN.md §2.1).
 * The subset script and the title fallback both read this string.
 * 46 code points: digits, 月 / 日, page titles, the home-screen mark, and the wordmark letters.
 * Letter order is not the product name, so the display name stays in src/config/brand.ts.
 */
export const SERIF_GLYPHS =
  '0123456789月日资产体重趋势我的删除账号正在已隐私政策找不到这一页星途Vistela';

export const SERIF_FONT_FILE = 'public/fonts/viastela-serif-600.v1.woff2';
export const SERIF_FONT_URL = '/fonts/viastela-serif-600.v1.woff2';
/** DESIGN.md §2.1 cap, measured on the file copied into the web export. */
export const SERIF_FONT_MAX_BYTES = 200 * 1024;

const glyphSet = new Set(SERIF_GLYPHS);

/** True when every code point is in the subset. An empty string is covered. */
export function serifCovers(text: string): boolean {
  for (const char of text) {
    if (!glyphSet.has(char)) return false;
  }
  return true;
}

/** Face name is the product display name plus this suffix. */
export const SERIF_FACE_SUFFIX = ' Serif';

export function webSerifStack(displayName: string, fallbackStack: string): string {
  return `"${displayName}${SERIF_FACE_SUFFIX}", ${fallbackStack}`;
}

/** Flatten title children so the coverage check sees the whole string. */
export function plainText(node: unknown): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map((item) => plainText(item)).join('');
  if (typeof node === 'object' && 'props' in node) {
    const props = (node as { props?: { children?: unknown } }).props;
    return plainText(props?.children);
  }
  return '';
}
