import { Text } from './Text';
import { maskedAmountMetrics, type MaskedAmountVariant } from './masked-amount';

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
  variant?: MaskedAmountVariant;
  tone?: Tone;
}) {
  const metrics = maskedAmountMetrics(text, variant);
  return (
    <Text
      variant={variant}
      tone={tone}
      accessibilityLabel={masked ? '已隐藏金额' : undefined}
      style={{ minWidth: metrics.minWidth, fontVariant: metrics.fontVariant }}
    >
      {masked ? '••••' : text}
    </Text>
  );
}
