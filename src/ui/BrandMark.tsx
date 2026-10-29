import { createElement } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { theme } from './theme';
import { useTheme } from './ThemeProvider';

/**
 * The V mark (§5, §14). Drawn on a 22-unit box and scaled to `size`.
 * V is `ink`, the star is `accent`; the brand mark does not count against the accent budget.
 * Decorative: the product name next to it carries the accessible name.
 */
export const BRAND_MARK_VIEWBOX = 22;
export const BRAND_MARK_V = 'M3 5 L11 19 L19 5';
export const BRAND_MARK_STAR = 'M11 1.5 l1 2.2 2.2 1 -2.2 1 -1 2.2 -1 -2.2 -2.2 -1 2.2 -1z';
/** Stroke of the V in viewBox units. */
export const BRAND_MARK_STROKE = 2.4;

export function BrandMark({ size = theme.layout.mark }: { size?: number }) {
  const { color } = useTheme();
  const viewBox = `0 0 ${BRAND_MARK_VIEWBOX} ${BRAND_MARK_VIEWBOX}`;
  if (Platform.OS === 'web') {
    return createElement(
      'svg',
      { width: size, height: size, viewBox, 'aria-hidden': true, 'data-component': 'BrandMark' },
      createElement('path', {
        d: BRAND_MARK_V,
        fill: 'none',
        stroke: color.ink,
        strokeWidth: BRAND_MARK_STROKE,
        strokeLinejoin: 'round',
      }),
      createElement('path', { d: BRAND_MARK_STAR, fill: color.accent }),
    );
  }
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={viewBox}>
        <Path d={BRAND_MARK_V} fill="none" stroke={color.ink} strokeWidth={BRAND_MARK_STROKE} strokeLinejoin="round" />
        <Path d={BRAND_MARK_STAR} fill={color.accent} />
      </Svg>
    </View>
  );
}
