import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Row } from './layout';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';

/**
 * One wrapping row of chips, or a Charioteer-style recessed segmented control bar (`segmented`).
 */
export function ChipGroup({
  segmented = false,
  children,
}: {
  segmented?: boolean;
  children: ReactNode;
}) {
  const { color } = useTheme();
  if (segmented) {
    return (
      <View
        style={[
          styles.segmentedBar,
          {
            backgroundColor: color.paperDeep,
            borderColor: color.line,
          },
        ]}
      >
        {Children.map(children, (child) =>
          isValidElement(child)
            ? cloneElement(child as ReactElement<{ segmented?: boolean }>, { segmented: true })
            : child,
        )}
      </View>
    );
  }
  return (
    <Row gap="xs" wrap>
      {children}
    </Row>
  );
}

const styles = StyleSheet.create({
  segmentedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 10,
    borderWidth: theme.border.width,
    gap: 2,
  },
});
