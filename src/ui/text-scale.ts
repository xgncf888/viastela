import { theme } from './theme';

export type TextVariant =
  | 'display'
  | 'title'
  | 'metric'
  | 'heading'
  | 'body'
  | 'tab'
  | 'label'
  | 'caption'
  | 'muted';

/** Titles, large figures, metric, heading, and tab text. Everything else is body copy. */
const HEADING_SCALE = new Set<TextVariant>(['display', 'title', 'metric', 'heading', 'tab']);

/** Upper bound passed to `Text` as `maxFontSizeMultiplier`. Web ignores it and uses browser zoom. */
export function maxFontSizeMultiplierFor(variant: TextVariant): number {
  return HEADING_SCALE.has(variant) ? theme.fontScale.heading : theme.fontScale.body;
}
