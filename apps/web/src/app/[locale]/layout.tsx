import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { fontVariables } from '@/lib/fonts';
import { routing } from '@/i18n/routing';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Kynite',
  // Static, not per-locale: this is a module-level `Metadata` object, not
  // `generateMetadata()`, so there is no request to read a locale from (the
  // same constraint `src/app/manifest.ts` documents). `nl` is
  // `routing.defaultLocale` — the string below matches `manifest.ts`'s and
  // `hub.webmanifest`'s Dutch description instead of contradicting them.
  description: 'Gezinsplanning die daadwerkelijk gebeurt.',
  // The parent-app manifest (`src/app/manifest.ts`). The hub tree overrides
  // this with its own (§6: two installable surfaces, one service worker).
  manifest: '/manifest.webmanifest',
  applicationName: 'Kynite',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Kynite' },
  // iOS ignores the manifest's icons and reads this instead. The SVG is the
  // brand mark itself (`docs/design/assets/logo-icon.svg`); the 96px PNG is the
  // raster fallback for the browsers and bookmark UIs that will not take one.
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/favicon-96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  // Matches both manifests, so the installed title bar is the brand indigo
  // (`docs/design/colors.md` "Primary").
  themeColor: '#5d5fef',
  // A wall tablet and a phone both want the full display; neither wants a
  // pinch-zoom that a small hand can trigger by accident.
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    // `suppressHydrationWarning` covers exactly one thing: the kiosk's
    // pre-paint script sets `data-surface`/`data-hub-theme` and the `.dark`
    // class on this element before React hydrates ((hub)/layout.tsx). React
    // would otherwise warn about attributes the server never rendered — which
    // is the whole point of the script, since deferring them to an effect would
    // flash a phone-sized light board across the room on every hub boot. The
    // flag is not inherited by children; only this element's own attributes are
    // exempt.
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        {/* No `ServiceWorkerRegistrar` here (B-1 fix): this layout also wraps
            `(share)`, and a caregiver's browser must never install the
            worker at all — not even one that then routes their page
            `network-only`. `(app)/layout.tsx` and `(hub)/layout.tsx` each
            mount their own registrar instead, since those are the only two
            surfaces the PWA guarantees apply to. */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
