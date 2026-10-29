/**
 * Bottom tabs stay attached after the first visit.
 * `detachInactiveScreens` defaults to true on web, which unmounts the screen
 * and refetches when the person comes back.
 */
export const tabNavigator = {
  detachInactiveScreens: false,
  lazy: true,
  headerShown: false,
} as const;
