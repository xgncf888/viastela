import { Platform } from 'react-native';

import { brand } from '@/config/brand';

import { SERIF_FACE_SUFFIX, SERIF_FONT_URL, webSerifStack } from './serif-glyphs';
import { theme } from './theme';

/** Id of the style tag inserted on web. Not the product name. */
export const SERIF_FACE_STYLE_ID = 'app-serif-face';

/**
 * Stack used by web page titles once the subset is present.
 * Native builds never read this: `Text` only sets a title face when `Platform.OS === 'web'`.
 */
export function webTitleFontFamily(): string {
  return webSerifStack(brand.displayName, theme.fontFamily.serif);
}

/**
 * Install `@font-face` on web.
 * Single-file export serves `public/index.html` and does not render `app/+html.tsx`,
 * and that shell cannot hardcode the product name. The face is created from `brand.displayName`.
 */
export function installWebSerifFace(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || document.head == null) return;
  if (document.getElementById(SERIF_FACE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SERIF_FACE_STYLE_ID;
  const family = JSON.stringify(`${brand.displayName}${SERIF_FACE_SUFFIX}`);
  style.appendChild(
    document.createTextNode(
      `@font-face{font-family:${family};src:url("${SERIF_FONT_URL}") format("woff2");font-weight:500 600;font-style:normal;font-display:swap;}`,
    ),
  );
  document.head.appendChild(style);
}
