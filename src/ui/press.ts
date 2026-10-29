import { theme } from './theme';

type PressStyle = {
  opacity?: number;
  transform?: { scale: number }[];
  backgroundColor?: string;
  transitionProperty?: string;
  transitionDuration?: string;
};

export type PressTokens = typeof theme.press;

/** Unpressed endpoints. Pressed values come from `theme.press`. */
const REST_OPACITY = 1;
const REST_SCALE = 1;

/** 0ms in, release duration from the theme. Reduced motion snaps both ways. */
export function pressTransition(pressed: boolean, reducedMotion: boolean, press: PressTokens, web: boolean): PressStyle {
  const duration = reducedMotion || pressed ? press.inMs : press.releaseMs;
  if (!web) return {};
  return {
    transitionProperty: 'opacity, transform, background-color',
    transitionDuration: `${duration}ms`,
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
