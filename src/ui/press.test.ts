import { expect, test } from '@jest/globals';

import { darkColor, lightColor, theme } from './theme';
import { pressTransition, solidPressStyle, washPressStyle } from './press';

test('press tokens are the baseline Hazel can swap later', () => {
  expect(theme.press).toEqual({
    inMs: 0,
    releaseMs: 100,
    opacity: 0.86,
    scale: 0.98,
    disabledOpacity: 0.55,
  });
  expect(lightColor.pressed).toBe('rgba(38, 36, 31, 0.06)');
  expect(darkColor.pressed).toBe('rgba(250, 249, 245, 0.08)');
});

test('solid press uses the theme opacity and scale, and snaps in', () => {
  const pressed = solidPressStyle(true, false, false, theme.press, true);
  expect(pressed.opacity).toBe(theme.press.opacity);
  expect(pressed.transform).toEqual([{ scale: theme.press.scale }]);
  expect(pressed.transitionDuration).toBe(`${theme.press.inMs}ms`);

  const resting = solidPressStyle(false, false, false, theme.press, true);
  expect(resting.opacity).toBe(1);
  expect(resting.transform).toEqual([{ scale: 1 }]);
  expect(resting.transitionDuration).toBe(`${theme.press.releaseMs}ms`);

  const disabled = solidPressStyle(true, true, false, theme.press, true);
  expect(disabled.opacity).toBe(theme.press.disabledOpacity);
  expect(disabled.transform).toBeUndefined();

  const reduced = solidPressStyle(false, false, true, theme.press, true);
  expect(reduced.transitionDuration).toBe(`${theme.press.inMs}ms`);
});

test('row and tab press washes the full surface with the pressed token', () => {
  const down = washPressStyle(true, false, theme.press, lightColor.pressed, true);
  expect(down.backgroundColor).toBe(lightColor.pressed);
  expect(pressTransition(true, false, theme.press, true).transitionDuration).toBe(`${theme.press.inMs}ms`);
  const up = washPressStyle(false, false, theme.press, lightColor.pressed, true);
  expect(up.backgroundColor).toBe('transparent');
  expect(up.transitionDuration).toBe(`${theme.press.releaseMs}ms`);
});
