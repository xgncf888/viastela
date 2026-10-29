import { Redirect } from 'expo-router';

import { reminderSettingsRedirect, RemindersSettingsScreen } from '@/features/me/RemindersSettingsScreen';

export default function RemindersSettingsRoute() {
  const back = reminderSettingsRedirect();
  if (back) return <Redirect href={back} />;
  return <RemindersSettingsScreen />;
}
