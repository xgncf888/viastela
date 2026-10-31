import { theme } from './theme';

type PressStyle = {
  opacity?: number;
  transform?: { scale: number }[];
  backgroundColor?: string;
  transitionProperty?: string;
  transitionDuration?: string;
  transitionTimingFunction?: string;
};

export type PressTokens = typeof theme.press;

/** Unpressed endpoints. Pressed values come from `theme.press`. */
const REST_OPACITY = 1;
const REST_SCALE = 1;

/** 50ms in, 160ms release from the theme (0ms when reduced motion is enabled). */
export function pressTransition(pressed: boolean, reducedMotion: boolean, press: PressTokens, web: boolean): PressStyle {
  const duration = reducedMotion ? 0 : pressed ? press.inMs : press.releaseMs;
  if (!web) return {};
  return {
    transitionProperty: 'opacity, transform, background-color',
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: press.easing,
  };
}

/** Solid buttons (primary, danger). Secondary, ghost, and mini change background instead. */
export function solidPressStyle(
  pressed: boolean,
  disabled: boolean,
  reducedMotion: boolean,
  press: PressTokens,
  web: boolean,
): PressStyle {
  return {
    opacity: disabled ? press.disabledOpacity : pressed ? press.opacity : REST_OPACITY,
    transform: disabled ? undefined : [{ scale: pressed ? press.scale : REST_SCALE }],
    ...pressTransition(pressed, reducedMotion, press, web),
  };
}

export function washPressStyle(
  pressed: boolean,
  reducedMotion: boolean,
  press: PressTokens,
  wash: string,
  web: boolean,
): PressStyle {
  return {
    backgroundColor: pressed ? wash : 'transparent',
    ...pressTransition(pressed, reducedMotion, press, web),
  };
}
