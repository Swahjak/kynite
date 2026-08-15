import 'server-only';
import { cache } from 'react';
import { getLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { defaultFormattingLocale, type FormattingLocale } from '@/i18n/formatting-locale';
import { getPrincipal } from './principal';
import { getFamily } from './queries';

/**
 * The server-component half of the household date/time convention split
 * (`src/i18n/formatting-locale.ts`, `components/formatting/` for the client
 * half).
 *
 * Server Components can't read the client `FormattingLocaleProvider` context
 * (Server Components never consume context from a Client Component ancestor),
 * so `getFormatter()`/`format.dateTime()` calls made directly in a Server
 * Component — `now-hero.tsx`, the hub's routines/timers pages, `routine-list.tsx`,
 * `star-chart.tsx`, `up-next-grid.tsx`, `share-board.tsx` — resolve this
 * themselves instead of receiving it as a prop from a shared loader. That
 * costs an extra `getFamily()` read on servers that don't already have one in
 * scope; `React.cache` dedupes it against any other `getFamily()` call already
 * made for the same request (`getPrincipal()` is already memoised the same
 * way), so the marginal cost per request is at most one query, not one per
 * call site.
 *
 * Falls back to the UI locale's default (`nl` → `nl-NL`, `en` → `en-GB`) for a
 * device with no principal (the hub's pair screen) or a share link (which
 * carries its own timezone but not, currently, its own convention — the
 * caregiver's browser locale governs `messages`, and `en-GB` is what an
 * unconfigured English household gets everywhere else too).
 */
export const getHouseholdFormattingLocale = cache(async (): Promise<FormattingLocale> => {
  const requested = await getLocale();
  const uiLocale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const principal = await getPrincipal();
  if (!principal) return defaultFormattingLocale(uiLocale);

  const family = await getFamily(principal.familyId);
  return family?.formattingLocale ?? defaultFormattingLocale(uiLocale);
});
