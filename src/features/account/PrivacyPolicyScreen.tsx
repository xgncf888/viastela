import { StyleSheet, View } from 'react-native';

import { brand } from '@/config/brand';
import { privacyParagraphs, privacyUpdatedLabel } from '@/core/account-policy';
import { Content } from '@/ui/Content';
import { documentEdges, Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { theme } from '@/ui/theme';

export function PrivacyPolicyScreen() {
  return (
    <Screen edges={documentEdges}>
      <Content inset={theme.space.xxl}>
        <Text variant="muted">{privacyUpdatedLabel()}</Text>
        <Text variant="title" accessibilityRole="header">
          隐私政策
        </Text>
        <View style={styles.copy}>
          {privacyParagraphs(brand.displayName).map((paragraph) => (
            <Text key={paragraph} variant="body" style={styles.body}>
              {paragraph}
            </Text>
          ))}
        </View>
      </Content>
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: { gap: theme.space.md },
  body: { lineHeight: theme.space.lg },
});
