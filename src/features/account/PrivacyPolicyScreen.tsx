import { StyleSheet, View } from 'react-native';

import { brand } from '@/config/brand';
import { privacyParagraphs, privacyUpdatedLabel } from '@/core/account-policy';
import { Card } from '@/ui/Card';
import { Content } from '@/ui/Content';
import { Divider, Row } from '@/ui/layout';
import { documentEdges, Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { theme } from '@/ui/theme';

export function PrivacyPolicyScreen() {
  return (
    <Screen edges={documentEdges}>
      <Content inset={theme.space.xxl}>
        <Row justify="between" align="center" wrap>
          <Text variant="title" accessibilityRole="header">
            隐私政策
          </Text>
          <Text variant="muted">{privacyUpdatedLabel()}</Text>
        </Row>
        <Card>
          <View style={styles.copy}>
            {privacyParagraphs(brand.displayName).map((paragraph, index) => (
              <View key={paragraph} style={styles.block}>
                {index > 0 ? <Divider /> : null}
                <Text variant="body" style={styles.body}>
                  {paragraph}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      </Content>
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: { gap: theme.space.md },
  block: { gap: theme.space.md },
  body: { lineHeight: theme.space.lg },
});
