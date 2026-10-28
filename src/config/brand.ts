/**
 * Product name, URL scheme, store ids, and icon paths live here.
 * Installed-web names are derived from webName.
 */
export const brand = {
  displayName: 'Viastela',
  /** Home-screen label, manifest short_name, and apple-mobile-web-app-title. */
  webName: '星途',
  slug: 'viastela',
  scheme: 'viastela',
  iosBundleIdentifier: 'com.viastela.app',
  androidPackage: 'com.viastela.app',
  icon: './assets/icon.png',
  splash: './assets/splash-icon.png',
  androidForeground: './assets/android-icon-foreground.png',
  androidBackground: './assets/android-icon-background.png',
  androidMonochrome: './assets/android-icon-monochrome.png',
} as const;

/** manifest name */
export const webManifestName = `${brand.displayName} ${brand.webName}`;

/** Browser tab title. */
export const webDocumentTitle = `${brand.webName} · ${brand.displayName}`;
