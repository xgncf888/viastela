import { Slot } from 'expo-router';

import { StudyProvider } from '@/features/study/StudyProvider';
import { AppShell } from '@/features/shell/AppShell';
import { TrainingProvider } from '@/features/training/TrainingProvider';
import { WeightProvider } from '@/features/weight/WeightProvider';

export default function AppLayout() {
  return (
    <WeightProvider>
      <TrainingProvider>
        <StudyProvider>
          <AppShell>
            <Slot />
          </AppShell>
        </StudyProvider>
      </TrainingProvider>
    </WeightProvider>
  );
}
