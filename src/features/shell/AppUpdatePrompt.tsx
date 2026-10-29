import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  appUpdateMessage,
  checksAndroidAppUpdate,
  fetchAppUpdate,
  installedAndroidVersionCode,
  type AppRelease,
} from '@/core/android-apk';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Text } from '@/ui/Text';
import { theme } from '@/ui/theme';

function openDownload(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

export function AppUpdatePrompt() {
  const prompt = useAppUpdatePrompt();
  const insets = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState(false);
  if (!prompt || dismissed) return null;
  return (
    <View pointerEvents="box-none" style={[styles.banner, { paddingTop: insets.top }]}>
      <Card>
        <Text variant="body" accessibilityLiveRegion="polite">
          {appUpdateMessage(prompt)}
        </Text>
        <Button label="下载" onPress={() => openDownload(prompt.url)} />
        <Button label="关闭" variant="ghost" onPress={() => setDismissed(true)} />
      </Card>
    </View>
  );
}

function useAppUpdatePrompt(): AppRelease | null {
  const [prompt, setPrompt] = useState<AppRelease | null>(null);
  useEffect(() => {
    if (!checksAndroidAppUpdate(Platform.OS)) return;
    const installed = installedAndroidVersionCode(Constants.nativeBuildVersion);
    if (installed == null) return;
    let cancel = false;
    void fetchAppUpdate(installed).then((next) => {
      if (!cancel) setPrompt(next);
    });
    return () => {
      cancel = true;
    };
  }, []);
  return prompt;
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.space.md,
    paddingBottom: theme.space.md,
    zIndex: 2,
  },
});
