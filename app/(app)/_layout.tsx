import { Tabs } from 'expo-router';

import { StudyProvider } from '@/features/study/StudyProvider';
import { AppShell } from '@/features/shell/AppShell';
import { tabNavigator } from '@/features/shell/tab-navigator';
import { TrainingProvider } from '@/features/training/TrainingProvider';
import { WeightProvider } from '@/features/weight/WeightProvider';
import { useTheme } from '@/ui/ThemeProvider';

export default function AppLayout() {
  const { color } = useTheme();
  return (
    <WeightProvider>
      <TrainingProvider>
        <StudyProvider>
          <AppShell>
            <Tabs
              detachInactiveScreens={tabNavigator.detachInactiveScreens}
              tabBar={() => null}
              screenOptions={{
                headerShown: tabNavigator.headerShown,
                lazy: tabNavigator.lazy,
                sceneStyle: { backgroundColor: color.paper },
              }}
            >
              <Tabs.Screen name="index" />
              <Tabs.Screen name="assets" />
              <Tabs.Screen name="trend" />
              <Tabs.Screen name="timeline" />
              <Tabs.Screen name="me" />
              <Tabs.Screen name="reminders" options={{ href: null }} />
            </Tabs>
          </AppShell>
        </StudyProvider>
      </TrainingProvider>
    </WeightProvider>
  );
}
