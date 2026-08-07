'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { fontVariables } from '@/lib/fonts';
import { routing } from '@/i18n/routing';
import en from '../../messages/en.json';
import nl from '../../messages/nl.json';
import './globals.css';

/**
 * The last-resort boundary (M18): an error thrown by the root layout itself,
 * which `[locale]/error.tsx` cannot catch because it renders *inside* that
 * layout. Next replaces the entire document with this, so it owns `<html>` and
 * `<body>` — and, more awkwardly, it renders **outside**
 * `NextIntlClientProvider`, because the provider is the thing that may have
 * failed.
 *
 * So the copy is read out of the message files directly rather than through
 * `useTranslations`. That keeps every user-facing string in
 * `messages/{nl,en}.json` where a translator can see it (and where
 * `tests/unit/i18n/*` keep the two files in step) at the cost of a static
 * import of both — acceptable for a chunk the browser only ever downloads when
 * the application has already fallen over.
 *
 * The locale is read from the URL through `useSyncExternalStore`, which is the
 * one API that lets a render depend on a *browser* value without lying to
 * hydration: `localePrefix: 'always'` makes the first path segment
 * authoritative, the server snapshot is the default locale, and React
 * reconciles the two itself. `location` never changes under this component
 * (a navigation unmounts it), so the subscribe function has nothing to do.
 */

const MESSAGES = { nl, en } as const;

function localeFromPath(pathname: string): keyof typeof MESSAGES {
  const segment = pathname.split('/').filter(Boolean)[0];
  return routing.locales.includes(segment as (typeof routing.locales)[number])
    ? (segment as keyof typeof MESSAGES)
    : routing.defaultLocale;
}

/** `location` cannot change without unmounting this tree — nothing to watch. */
const subscribe = () => () => {};

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const locale = useSyncExternalStore(
    subscribe,
    () => localeFromPath(window.location.pathname),
    () => routing.defaultLocale
  );

  useEffect(() => {
    console.error(error);
  }, [error]);

  const copy = MESSAGES[locale].errors;

  return (
    <html lang={locale} className={fontVariables}>
      <body className="min-h-dvh antialiased">
        <main
          data-testid="global-error"
          className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center"
        >
          <h1 className="font-display text-h2 font-bold">{copy.title}</h1>
          <p className="text-body text-ink-secondary">{copy.body}</p>
          {/* A plain anchor, not `next/link`: the router is part of what just
              failed, so the only reliable recovery is a fresh document. */}
          <a
            href={`/${locale}`}
            className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-medium text-primary-foreground"
          >
            {copy.home}
          </a>
        </main>
      </body>
    </html>
  );
}
