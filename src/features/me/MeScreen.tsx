import { useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';

import { brand } from '@/config/brand';
import { signOut } from '@/data/auth';
import { useAuth } from '@/features/auth/AuthProvider';
import { homeScreenInstallHint } from '@/features/me/home-screen-hint';
import { RemindersCard } from '@/features/me/RemindersCard';
import { useShellInset } from '@/features/shell/AppShell';
import { useWeight } from '@/features/weight/WeightProvider';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Content } from '@/ui/Content';
import { Field, ScreenHeader, Stack } from '@/ui/layout';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { showToast } from '@/ui/toast';

function installHint(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return homeScreenInstallHint({
    web: true,
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    standalone: window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true,
  });
}

export function MeScreen() {
  const { session } = useAuth();
  const { daySwitch, timeZone, saveDaySwitch } = useWeight();
  const inset = useShellInset();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const value = draft ?? daySwitch;
  const hint = installHint();

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
        <ScreenHeader kicker="我的" title={brand.displayName} />
        <Card>
          <Field label="邮箱" value={session?.email ?? '未登录'} />
        </Card>
        <Card>
          <TextField
            label="日切时间"
            value={value}
            onChangeText={setDraft}
            placeholder="04:00"
            helper="默认 04:00。改了只影响之后的新记录，已经记下的归属日不会变。"
            error={error}
          />
          <Button label="保存" onPress={() => void onSave()} loading={saving} />
        </Card>
        <Card>
          <Field
            label="当前时区"
            value={timeZone}
            hint="每条记录写下当时的时区。之后换城市，旧记录的归属日不变。"
          />
        </Card>
        <RemindersCard />
        <Card>
          <Text variant="body">体重、训练和学习可以在今日记。时间块还在后面。</Text>
        </Card>
        {hint ? (
          <Card>
            <Field label="添加到主屏幕" value={hint} />
          </Card>
        ) : null}
        <Button label="隐私政策" variant="ghost" onPress={() => router.push('/privacy')} />
        <Stack gap="lg">
          <Button
            label="退出登录"
            variant="secondary"
            loading={signingOut}
            onPress={() => {
              setSigningOut(true);
              void signOut().finally(() => setSigningOut(false));
            }}
          />
          <Button label="删除账号" variant="ghost" tone="danger" onPress={() => router.push('/account/delete')} />
        </Stack>
      </Content>
    </Screen>
  );
}
