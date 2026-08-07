import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // A default, not the answer: the timezone that actually governs a
    // family's dates lives on their `family` row, not on the request locale
    // (a `nl` family can be in Curaçao, an `en` family in Amsterdam). This
    // keeps `getRequestConfig` deterministic for surfaces with no family in
    // scope yet — marketing, auth, the share-link 404 — so SSR never guesses.
    // `(app)/layout.tsx` and `(hub)/layout.tsx` override it per-request from
    // the principal's family once one exists; `(share)` passes the shared
    // family's zone explicitly into its own `format` calls instead, since a
    // caregiver's zone is per-link, not per-provider.
    timeZone: 'Europe/Amsterdam',
  };
});
