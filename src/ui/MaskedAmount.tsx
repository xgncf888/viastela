import { Text } from './Text';
import { theme } from './theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'muted';
type Tone = 'ink' | 'muted' | 'inverse' | 'accent' | 'onAccent' | 'danger' | 'moss' | 'warning';

/** Amounts render as •••• while masked. The real figure is not in the tree. */
export function MaskedAmount({
  text,
  masked,
  variant = 'body',
  tone,
}: {
  text: string;
  masked: boolean;
  variant?: Variant;
  tone?: Tone;
}) {
  const minWidth = text.length * (theme.font.md * 0.62);
  if (!masked) {
    return (
      <Text variant={variant} tone={tone} style={{ minWidth }}>
        {text}
      </Text>
    );
  }
  return (
    <Text variant={variant} tone={tone} accessibilityLabel="已隐藏金额" style={{ minWidth }}>
      ••••
    </Text>
  );
}
