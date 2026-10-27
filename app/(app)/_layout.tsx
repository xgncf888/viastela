import { Slot } from 'expo-router';

import { AppShell } from '@/features/shell/AppShell';
import { TrainingProvider } from '@/features/training/TrainingProvider';
import { WeightProvider } from '@/features/weight/WeightProvider';

export default function AppLayout() {
  return (
    <WeightProvider>
      <TrainingProvider>
        <AppShell>
          <Slot />
        </AppShell>
      </TrainingProvider>
    </WeightProvider>
  );
}
