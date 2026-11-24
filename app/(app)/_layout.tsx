import { Tabs } from 'expo-router';

import { AppShell } from '@/features/shell/AppShell';
import { tabNavigator } from '@/features/shell/tab-navigator';
import { useTheme } from '@/ui/ThemeProvider';

export default function AppLayout() {
  const { color } = useTheme();
  return (
    <AppShell>
      <Tabs
              detachInactiveScreens={tabNavigator.detachInactiveScreens}
              tabBar={() => null}
              screenOptions={{
                headerShown: tabNavigator.headerShown,
                lazy: tabNavigator.lazy,
                animation: 'none',
                sceneStyle: { backgroundColor: color.paper },
              }}
            >
              <Tabs.Screen name="index" />
              <Tabs.Screen name="ledger" />
              <Tabs.Screen name="study" />
              <Tabs.Screen name="browser" />
              <Tabs.Screen name="fitness" />
              <Tabs.Screen name="assets" />
              <Tabs.Screen name="trend" />
              <Tabs.Screen name="timeline" />
              <Tabs.Screen name="me" />
              <Tabs.Screen name="reminders" options={{ href: null }} />
            </Tabs>
    </AppShell>
  );
}
