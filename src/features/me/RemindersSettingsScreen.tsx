import { Platform } from 'react-native';

import { RemindersCard } from '@/features/me/RemindersCard';

/** Where a direct open of the settings route goes on native. Web stays on the page. */
export function reminderSettingsRedirect(): '/me' | null {
  return Platform.OS === 'web' ? null : '/me';
}

/** Settings body. Native renders nothing, including the unsupported explanation. */
export function RemindersSettingsScreen() {
  if (Platform.OS !== 'web') return null;
  return <RemindersCard />;
}
