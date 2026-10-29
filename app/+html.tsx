import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

import { brand, webDocumentTitle } from '@/config/brand';
import { pwaIcons, pwaManifest, pwaSplashes, splashMedia, splashPath } from '@/config/pwa';
import { darkColor } from '@/ui/theme';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="zh-Hans">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>{webDocumentTitle}</title>
        <meta name="theme-color" content={pwaManifest.theme_color} media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content={darkColor.paper} media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={brand.webName} />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href={pwaIcons.svg} type="image/svg+xml" />
        <link rel="icon" href={pwaIcons.ico} sizes="32x32" />
        <link rel="apple-touch-icon" href={pwaIcons.appleTouch} />
        {pwaSplashes.map((splash) => (
          <link
            key={`${splash.deviceWidth}x${splash.deviceHeight}@${splash.ratio}`}
            rel="apple-touch-startup-image"
            href={splashPath(splash)}
            media={splashMedia(splash)}
          />
        ))}
        <script src="/pwa-head.js" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
