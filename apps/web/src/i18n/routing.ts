import { defineRouting } from 'next-intl/routing';

export const locales = ['nl', 'en'] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: 'nl',
  localePrefix: 'always',
  // Household expectation is Dutch by default: a bare `/` must always land on
  // `/nl`, never negotiate the visitor's browser `Accept-Language` (or a
  // stale `NEXT_LOCALE` cookie) into `/en`. Explicit `/en/...` URLs are
  // untouched by this — `localePrefix: 'always'` keeps them reachable, and an
  // in-app link that points at a prefixed URL still navigates there
  // directly; only the *negotiation* that runs when no locale is in the URL
  // is disabled.
  localeDetection: false,
});
