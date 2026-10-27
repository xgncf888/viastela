import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

import { brand } from '@/config/brand';
import { pwaIcons, pwaManifest, pwaSplashes, splashMedia, splashPath } from '@/config/pwa';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="zh-Hans">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>{brand.displayName}</title>
        <meta name="theme-color" content={pwaManifest.theme_color} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={brand.homeScreenShortName} />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href={pwaIcons.appleTouch} />
        {pwaSplashes.map((splash) => (
          <link
            key={`${splash.deviceWidth}x${splash.deviceHeight}@${splash.ratio}`}
            rel="apple-touch-startup-image"
            href={splashPath(splash)}
            media={splashMedia(splash)}
          />
        ))}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
