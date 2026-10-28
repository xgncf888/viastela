import { StyleSheet } from 'react-native';

import { Text } from './Text';
import { theme } from './theme';
import { HIDDEN_AMOUNT_LABEL, maskedAmountMetrics, type MaskedAmountVariant } from './masked-amount';

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
  const slot = { minWidth: metrics.minWidth, fontVariant: metrics.fontVariant };
  if (!masked) {
    return (
      <Text variant={variant} tone={tone} style={slot}>
        {text}
      </Text>
    );
  }
  return (
    <Text variant={variant} tone={tone} accessible={false} style={[slot, styles.slot]}>
      <Text
        variant={variant}
        tone={tone}
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={slot}
      >
        ••••
      </Text>
      <Text variant="body" style={styles.screenReaderOnly}>
        {HIDDEN_AMOUNT_LABEL}
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'relative',
  },
  screenReaderOnly: {
    position: 'absolute',
    width: theme.border.width,
    height: theme.border.width,
    overflow: 'hidden',
  },
});
