/**
 * Product name and icon paths live here.
 * Bundle ids and the URL scheme are neutral on purpose: renaming the product
 * must not force a new store listing or a new deep-link scheme.
 */
export const brand = {
  displayName: 'Viastela',
  slug: 'viastela',
  scheme: 'lifeapp',
  iosBundleIdentifier: 'com.personal.lifeapp',
  androidPackage: 'com.personal.lifeapp',
  icon: './assets/icon.png',
  splash: './assets/splash-icon.png',
  favicon: './assets/favicon.png',
  androidForeground: './assets/android-icon-foreground.png',
  androidBackground: './assets/android-icon-background.png',
  androidMonochrome: './assets/android-icon-monochrome.png',
} as const;
