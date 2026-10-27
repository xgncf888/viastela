import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { brand } from '@/config/brand';
import { useAuth } from '@/features/auth/AuthProvider';
import { useShellInset } from '@/features/shell/AppShell';
import { useWeight } from '@/features/weight/WeightProvider';
import { signOut } from '@/data/auth';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Content } from '@/ui/Content';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { showToast } from '@/ui/toast';
import { theme } from '@/ui/theme';

export function MeScreen() {
  const { session } = useAuth();
  const { daySwitch, timeZone, saveDaySwitch } = useWeight();
  const inset = useShellInset();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const value = draft ?? daySwitch;

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      await saveDaySwitch(value);
      setDraft(null);
      showToast({ text: '已保存' });
    } catch (saveError) {
      setError(saveError instanceof Error && saveError.message.includes('04:00') ? saveError.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Content inset={inset}>
        <View style={styles.header}>
          <Text variant="muted">我的</Text>
          <Text variant="title" accessibilityRole="header">
            {brand.displayName}
          </Text>
        </View>
        <Card>
          <Text variant="muted">邮箱</Text>
          <Text variant="body">{session?.email ?? '未登录'}</Text>
        </Card>
        <Card>
          <TextField
            label="日界时间"
            value={value}
            onChangeText={setDraft}
            placeholder="04:00"
            helper="默认 04:00。改了只影响之后的新记录，已经记下的归属日不会变。"
            error={error}
          />
          <Button label="保存" onPress={() => void onSave()} loading={saving} />
        </Card>
        <Card>
          <Text variant="muted">当前时区</Text>
          <Text variant="body">{timeZone}</Text>
          <Text variant="muted">每条记录写下当时的时区。之后换城市，旧记录的归属日不变。</Text>
        </Card>
        <Card>
          <Text variant="body">训练、学习和时间块还在后面。现在可以记体重。</Text>
        </Card>
        <Button
          label="退出登录"
          variant="secondary"
          loading={signingOut}
          onPress={() => {
            setSigningOut(true);
            void signOut().finally(() => setSigningOut(false));
          }}
        />
      </Content>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: theme.space.xs },
});
