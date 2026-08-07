import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { ServiceWorkerRegistrar } from '@/components/offline';
import { fontVariables } from '@/lib/fonts';
import { routing } from '@/i18n/routing';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Kynite',
  description: 'Family planning that actually gets done.',
  // The parent-app manifest (`src/app/manifest.ts`). The hub tree overrides
  // this with its own (§6: two installable surfaces, one service worker).
  manifest: '/manifest.webmanifest',
  applicationName: 'Kynite',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Kynite' },
  // iOS ignores the manifest's icons and reads this instead.
  icons: {
    icon: '/favicon.svg',
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  // Matches both manifests, so the installed title bar is brand green.
  themeColor: '#13ec92',
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
        <NextIntlClientProvider>
          {/* Registers the worker and nothing else — no permission prompt is
              reachable from a page load (§6 step 1, M11 cold-entry test). */}
          <ServiceWorkerRegistrar />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
