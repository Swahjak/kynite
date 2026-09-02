import { NextIntlClientProvider } from 'next-intl';
import { AmbientClock } from '@/components/hub';
import { FormattingLocaleProvider } from '@/components/formatting';
import { requireHubDevice } from '@/modules/devices';
import { getFamily, getHouseholdFormattingLocale } from '@/modules/family';

/**
 * `/hub/clock` — see `layout.tsx` for why this is its own route group.
 *
 * The auth gate lives here, not in the layout, for the same reason every
 * `(hub)` page states it: Next.js layouts don't re-render on client-side
 * navigation, so a check there only ever runs once. This tree has exactly one
 * page and no in-tree navigation, but the rule is cheap to keep and the one
 * place a stray future link would still be caught correctly.
 *
 * `requireHubDevice` also carries the household-locale-follow redirect every
 * hub page gets (M16) — a tablet paired under one locale keeps rendering the
 * date in it even after the family's language changes, exactly like `/hub`
 * itself.
 */
/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

export default async function HubClockPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const principal = await requireHubDevice(locale, '/hub/clock');

  // `getFamily` is `React.cache`-memoised (same call `getHouseholdFormattingLocale`
  // makes internally), so resolving both here costs one query, not two.
  const family = await getFamily(principal.familyId);
  const timeZone = family?.timezone ?? 'Europe/Amsterdam';
  const formattingLocale = await getHouseholdFormattingLocale();

  return (
    <NextIntlClientProvider timeZone={timeZone}>
      <FormattingLocaleProvider formattingLocale={formattingLocale}>
        <main
          data-testid="hub-clock"
          className="flex h-full w-full flex-col items-center justify-center"
        >
          <AmbientClock now={new Date()} />
        </main>
      </FormattingLocaleProvider>
    </NextIntlClientProvider>
  );
}
