import { theme } from './theme';

export type MaskedAmountVariant = 'display' | 'title' | 'heading' | 'body' | 'muted';

const FONT_SIZE: Record<MaskedAmountVariant, number> = {
  display: theme.font.display,
  title: theme.font.xl,
  heading: theme.font.lg,
  body: theme.font.md,
  muted: theme.font.sm,
};

export type MaskedAmountMetrics = {
  minWidth: number;
  fontVariant: ['tabular-nums'];
};

/**
 * Width reserved for the real amount, at the variant's font size.
 * Masked and unmasked text share this so toggling the mask does not jump.
 * Tabular figures keep digits the same width.
 */
export function maskedAmountMetrics(text: string, variant: MaskedAmountVariant): MaskedAmountMetrics {
  const fontSize = FONT_SIZE[variant];
  return {
    minWidth: text.length * fontSize * 0.62,
    fontVariant: ['tabular-nums'],
  };
}
