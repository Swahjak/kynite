import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';

/**
 * The **parent mobile PWA** manifest (docs/architecture.md §6 "Parent mobile").
 *
 * Served at `/manifest.webmanifest` by the App Router's file convention. The
 * hub has a manifest of its own (`public/hub.webmanifest`): the two surfaces
 * install as two different apps on purpose — a wall tablet that launches into
 * the parent app, or a phone that launches into the kiosk board, would both be
 * wrong, and the manifest's `start_url` is the only thing that decides which
 * you get.
 *
 * `start_url` carries the default locale prefix because `localePrefix` is
 * `'always'`: launching at `/` would cost every cold start a redirect, and an
 * offline cold start would find nothing cached at the un-prefixed URL at all.
 */
export default function manifest(): MetadataRoute.Manifest {
  const home = `/${routing.defaultLocale}/today`;

  return {
    id: home,
    name: 'Kynite',
    short_name: 'Kynite',
    // Static, not per-locale (the manifest route has no request to read a
    // locale from — see the class doc above). `nl` is `routing.defaultLocale`,
    // the same reasoning `lang` below already follows, and the one this
    // string now matches instead of contradicting it in English.
    description: 'Gezinsplanning die daadwerkelijk gebeurt.',
    start_url: home,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fbf9f4',
    theme_color: '#5d5fef',
    lang: routing.defaultLocale,
    dir: 'ltr',
    categories: ['productivity', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
