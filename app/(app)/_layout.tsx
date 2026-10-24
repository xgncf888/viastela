import { Slot } from 'expo-router';

import { AppShell } from '@/features/shell/AppShell';
import { WeightProvider } from '@/features/weight/WeightProvider';

export default function AppLayout() {
  return (
    <WeightProvider>
      <AppShell>
        <Slot />
      </AppShell>
    </WeightProvider>
  );
}
