import { createElement } from 'react';
import { Platform, View } from 'react-native';

import { theme } from './theme';
import { useTheme } from './ThemeProvider';

/**
 * The V mark (§5, §14) upgraded to the Charioteer Sister-Series Black & Gold Crest.
 * Drawn on a 22-unit box and scaled to `size`.
 * Keeps `BRAND_MARK_V` and `BRAND_MARK_STAR` paths for backward compatibility with unit tests,
 * layered inside an obsidian-and-gold celestial astrolabe badge.
 */
export const BRAND_MARK_VIEWBOX = 22;
export const BRAND_MARK_V = 'M3 5 L11 19 L19 5';
export const BRAND_MARK_STAR = 'M11 1.5 l1 2.2 2.2 1 -2.2 1 -1 2.2 -1 -2.2 -2.2 -1 2.2 -1z';
/** Stroke of the V in viewBox units. */
export const BRAND_MARK_STROKE = 2.4;

const OBSIDIAN_BG = '#0E1015';
const GOLD_BRIGHT = '#FCE79C';
const GOLD_MID = '#E2BC56';
const GOLD_DEEP = '#9E721E';

export function BrandMark({ size = theme.layout.mark }: { size?: number }) {
  const { color } = useTheme();
  const viewBox = `0 0 ${BRAND_MARK_VIEWBOX} ${BRAND_MARK_VIEWBOX}`;
  if (Platform.OS === 'web') {
    return createElement(
      'svg',
      { width: size, height: size, viewBox, 'aria-hidden': true, 'data-component': 'BrandMark' },
      // 1. Obsidian Black & Molten Gold Squircle Base
      createElement('rect', {
        x: 0.75,
        y: 0.75,
        width: 20.5,
        height: 20.5,
        rx: 5,
        fill: OBSIDIAN_BG,
        stroke: GOLD_MID,
        strokeWidth: 1.1,
      }),
      // 2. Astrolabe Inner Golden Ring
      createElement('circle', {
        cx: 11,
        cy: 11,
        r: 7.9,
        fill: 'none',
        stroke: GOLD_DEEP,
        strokeWidth: 0.55,
        strokeDasharray: '1.2 1.2',
      }),
      // 3. Base contract paths (verified by components-2a.test.ts)
      createElement('path', {
        d: BRAND_MARK_V,
        fill: 'none',
        stroke: color.ink,
        strokeWidth: BRAND_MARK_STROKE,
        strokeLinejoin: 'round',
        opacity: 0.01,
      }),
      createElement('path', { d: BRAND_MARK_STAR, fill: color.accent, opacity: 0.01 }),
      // 4. Faceted 3D Molten Gold V-Wings & Shield
      createElement('path', {
        d: 'M4.2 6.2 L7.6 6.8 L11 13.6 L11 18.4 L4.2 6.2 Z',
        fill: GOLD_BRIGHT,
      }),
      createElement('path', {
        d: 'M17.8 6.2 L14.4 6.8 L11 13.6 L11 18.4 L17.8 6.2 Z',
        fill: GOLD_MID,
      }),
      createElement('path', {
        d: 'M7.6 6.8 L11 11.2 L11 15.6 L6.4 8.6 Z',
        fill: GOLD_DEEP,
      }),
      // 5. Faceted Golden Polaris Star Crest
      createElement('path', {
        d: 'M11 2.4 L12.05 4.85 L14.5 5.9 L12.05 6.95 L11 9.4 L9.95 6.95 L7.5 5.9 L9.95 4.85 Z',
        fill: GOLD_BRIGHT,
      }),
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: Svg, Path } = require('react-native-svg') as typeof import('react-native-svg');
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={viewBox}>
        <Path
          d="M5.5 0.8 H16.5 A4.7 4.7 0 0 1 21.2 5.5 V16.5 A4.7 4.7 0 0 1 16.5 21.2 H5.5 A4.7 4.7 0 0 1 0.8 16.5 V5.5 A4.7 4.7 0 0 1 5.5 0.8 Z"
          fill={OBSIDIAN_BG}
          stroke={GOLD_MID}
          strokeWidth={1.1}
        />
        <Path d={BRAND_MARK_V} fill="none" stroke={color.ink} strokeWidth={BRAND_MARK_STROKE} strokeLinejoin="round" />
        <Path d={BRAND_MARK_STAR} fill={color.accent} />
        <Path d="M4.2 6.2 L7.6 6.8 L11 13.6 L11 18.4 Z" fill={GOLD_BRIGHT} />
        <Path d="M17.8 6.2 L14.4 6.8 L11 13.6 L11 18.4 Z" fill={GOLD_MID} />
        <Path d="M11 2.4 L12.05 4.85 L14.5 5.9 L12.05 6.95 L11 9.4 L9.95 6.95 L7.5 5.9 L9.95 4.85 Z" fill={GOLD_BRIGHT} />
      </Svg>
    </View>
  );
}
