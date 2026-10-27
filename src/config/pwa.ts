import { brand } from './brand';
import { theme } from '../ui/theme';

export type PwaSplash = {
  width: number;
  height: number;
  deviceWidth: number;
  deviceHeight: number;
  ratio: number;
};

/**
 * Portrait startup images. Several phones share one pixel size; each distinct
 * device-width still needs its own link, so the list is one entry per media query.
 */
export const pwaSplashes: readonly PwaSplash[] = [
  { width: 1320, height: 2868, deviceWidth: 440, deviceHeight: 956, ratio: 3 },
  { width: 1260, height: 2736, deviceWidth: 420, deviceHeight: 912, ratio: 3 },
  { width: 1290, height: 2796, deviceWidth: 430, deviceHeight: 932, ratio: 3 },
  { width: 1284, height: 2778, deviceWidth: 428, deviceHeight: 926, ratio: 3 },
  { width: 1206, height: 2622, deviceWidth: 402, deviceHeight: 874, ratio: 3 },
  { width: 1179, height: 2556, deviceWidth: 393, deviceHeight: 852, ratio: 3 },
  { width: 1170, height: 2532, deviceWidth: 390, deviceHeight: 844, ratio: 3 },
  { width: 1125, height: 2436, deviceWidth: 375, deviceHeight: 812, ratio: 3 },
  { width: 1080, height: 2340, deviceWidth: 360, deviceHeight: 780, ratio: 3 },
  { width: 1242, height: 2688, deviceWidth: 414, deviceHeight: 896, ratio: 3 },
  { width: 828, height: 1792, deviceWidth: 414, deviceHeight: 896, ratio: 2 },
  { width: 1242, height: 2208, deviceWidth: 414, deviceHeight: 736, ratio: 3 },
  { width: 750, height: 1334, deviceWidth: 375, deviceHeight: 667, ratio: 2 },
  { width: 640, height: 1136, deviceWidth: 320, deviceHeight: 568, ratio: 2 },
  { width: 2048, height: 2732, deviceWidth: 1024, deviceHeight: 1366, ratio: 2 },
  { width: 1668, height: 2388, deviceWidth: 834, deviceHeight: 1194, ratio: 2 },
  { width: 1668, height: 2224, deviceWidth: 834, deviceHeight: 1112, ratio: 2 },
  { width: 1640, height: 2360, deviceWidth: 820, deviceHeight: 1180, ratio: 2 },
  { width: 1620, height: 2160, deviceWidth: 810, deviceHeight: 1080, ratio: 2 },
  { width: 1536, height: 2048, deviceWidth: 768, deviceHeight: 1024, ratio: 2 },
  { width: 1488, height: 2266, deviceWidth: 744, deviceHeight: 1133, ratio: 2 },
];

export function splashMedia(splash: PwaSplash): string {
  return `screen and (device-width: ${splash.deviceWidth}px) and (device-height: ${splash.deviceHeight}px) and (-webkit-device-pixel-ratio: ${splash.ratio}) and (orientation: portrait)`;
}

export function splashPath(splash: PwaSplash): string {
  return `/icons/apple-splash-${splash.width}x${splash.height}.png`;
}

export const pwaIcons = {
  any192: '/icons/icon-192.png',
  any512: '/icons/icon-512.png',
  maskable512: '/icons/icon-maskable-512.png',
  appleTouch: '/icons/apple-touch-icon.png',
} as const;

export const pwaManifest = {
  name: brand.homeScreenName,
  short_name: brand.homeScreenShortName,
  start_url: '/',
  scope: '/',
  display: 'standalone',
  lang: 'zh-Hans',
  background_color: theme.color.paper,
  theme_color: theme.color.paper,
  icons: [
    { src: pwaIcons.any192, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: pwaIcons.any512, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: pwaIcons.maskable512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
} as const;
