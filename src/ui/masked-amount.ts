import { theme } from './theme';

export type MaskedAmountVariant = 'display' | 'title' | 'heading' | 'body' | 'muted';

const FONT_SIZE: Record<MaskedAmountVariant, number> = {
  display: theme.font.display,
  title: theme.font.xl,
  heading: theme.font.lg,
  body: theme.font.md,
  muted: theme.font.sm,
};

export const HIDDEN_AMOUNT_LABEL = '已隐藏金额';

export type AmountRowPiece = string | { text: string; masked: boolean };

/** Screen-reader line. A masked amount is spoken as 已隐藏金额; a visible one keeps its text. */
export function amountRowLabel(pieces: readonly AmountRowPiece[]): string {
  return pieces.map((piece) => (typeof piece === 'string' ? piece : piece.masked ? HIDDEN_AMOUNT_LABEL : piece.text)).join('');
}

/** Native rows own the label because a nested Text cannot. Web keeps the clipped text node. */
export function nativeAmountRowLabel(pieces: readonly AmountRowPiece[], os: string): string | undefined {
  if (os === 'web') return undefined;
  if (!pieces.some((piece) => typeof piece !== 'string' && piece.masked)) return undefined;
  return amountRowLabel(pieces);
}

/** Glyphs reserved for every amount of one variant. The real length is not used. */
const SLOT_GLYPHS = 8;

export type MaskedAmountMetrics = {
  minWidth: number;
  fontVariant: ['tabular-nums'];
};

/**
 * One slot width per variant. Masked and unmasked text share it, and the
 * width does not change with the number of digits. Tabular figures stay on.
 */
export function maskedAmountMetrics(_text: string, variant: MaskedAmountVariant): MaskedAmountMetrics {
  const fontSize = FONT_SIZE[variant];
  return {
    minWidth: SLOT_GLYPHS * fontSize * 0.62,
    fontVariant: ['tabular-nums'],
  };
}
