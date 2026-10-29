import { describe, expect, it } from '@jest/globals';

import { insetsBelowUpdatePrompt } from './app-update-insets';

const top = 47;
const bottom = 34;
const insets = { top, right: 0, bottom, left: 0 };

describe('insets below the update prompt', () => {
  it('leaves screen insets alone when the prompt is hidden', () => {
    expect(insetsBelowUpdatePrompt(insets, false)).toBe(insets);
  });

  it('consumes only the top inset while the prompt is visible', () => {
    expect(insetsBelowUpdatePrompt(insets, true)).toEqual({ top: 0, right: 0, bottom, left: 0 });
  });

  it('keeps the same object when the top inset is already zero', () => {
    const flat = { ...insets, top: 0 };
    expect(insetsBelowUpdatePrompt(flat, true)).toBe(flat);
  });
});
