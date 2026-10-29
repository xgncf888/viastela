import { useEffect, useState, type ReactNode } from 'react';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

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

import { insetsBelowUpdatePrompt } from './app-update-insets';

function openDownload(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

export function AppUpdatePrompt({ children }: { children: ReactNode }) {
  const prompt = useAppUpdatePrompt();
  const insets = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState(false);
  const visible = Boolean(prompt) && !dismissed;
  return (
    <View style={styles.column}>
      {visible && prompt ? (
        <View style={[styles.banner, { paddingTop: insets.top }]}>
          <Card>
            <Text variant="body" accessibilityLiveRegion="polite">
              {appUpdateMessage(prompt)}
            </Text>
            <Button label="下载" onPress={() => openDownload(prompt.url)} />
            <Button label="关闭" variant="ghost" onPress={() => setDismissed(true)} />
          </Card>
        </View>
      ) : null}
      <SafeAreaInsetsContext.Provider value={insetsBelowUpdatePrompt(insets, visible)}>
        <View style={styles.navigator}>{children}</View>
      </SafeAreaInsetsContext.Provider>
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
  column: {
    flex: 1,
  },
  navigator: {
    flex: 1,
  },
  banner: {
    paddingHorizontal: theme.space.md,
    paddingBottom: theme.space.md,
  },
});
