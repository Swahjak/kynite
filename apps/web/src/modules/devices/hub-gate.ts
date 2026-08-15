import 'server-only';
import { redirect } from '@/i18n/navigation';
import { locales, routing } from '@/i18n/routing';
import { getFamily, getPrincipal, type Principal } from '@/modules/family';

/**
 * The `(hub)` tree's authorization gate (M12).
 *
 * Called at the top of every hub page rather than once in the layout, and that
 * is deliberate: Next.js layouts are not re-rendered on client-side
 * navigations, so a check placed there runs on the first full page load and
 * then never again for the rest of the session. On a wall tablet that never
 * reloads for months, "never again" is the whole lifetime of the device. An
 * auth boundary has to sit on the segment that actually re-renders.
 *
 * Two ways to fail, two different answers:
 *
 *  - **no principal at all** — an unpaired tablet, or one whose device was
 *    revoked (`getPrincipal()` joins `revoked_at is null`, so revocation lands
 *    on the very next request). It goes to the pair screen, which is the only
 *    thing it can usefully do.
 *  - **a member principal** — a signed-in parent who typed `/hub`. They are
 *    sent to their own surface instead. Showing them the board would mean an
 *    owner-level session rendering the kiosk, which is exactly the state M12
 *    exists to end (§7: "a wall tablet is physically unauthenticated").
 */
export async function requireHubDevice(
  locale: string,
  href = '/hub',
  searchParams?: URLSearchParams | Record<string, string | undefined>
): Promise<Principal> {
  const principal = await getPrincipal();

  if (principal?.kind === 'device') {
    /**
     * The wall display speaks the household's language, not the URL's (M16).
     *
     * `family.locale` is the *household* setting — it already decides what
     * language a push notification is written in (`notifications/copy.ts`) —
     * and a kiosk is the one surface with no person behind it to hold a
     * preference of their own. A tablet paired at `/nl/hub` in a family that
     * later switches to English would otherwise keep rendering Dutch forever,
     * because nothing on a wall navigates.
     *
     * A redirect rather than an override of the request locale: `getLocale()`
     * and every `getTranslations()` in this tree resolve from the URL segment,
     * so moving the URL is what makes the *server-rendered* half follow too.
     * `href` is the caller's own route, so a deep hub page lands back on
     * itself rather than on the board. It cannot loop — after the redirect the
     * segment equals `family.locale`, and this branch is skipped.
     *
     * The parent app deliberately does **not** do this: two parents may read
     * the Controller in different languages, and `family.locale` is not a
     * statement about either of them (see `updateFamilyAction`).
     */
    const family = await getFamily(principal.familyId);
    // NB-4: `family.locale` is unconstrained text at the column, not an enum —
    // a bad value here (a stray migration, a hand-edited row) must not become
    // an infinite redirect loop between `locale` and itself. Falling back to
    // `routing.defaultLocale` keeps this a single hop even then.
    const targetLocale =
      family && (locales as readonly string[]).includes(family.locale)
        ? family.locale
        : routing.defaultLocale;

    if (family && targetLocale !== locale) {
      // NB-3: `?date=`/`?member=`/`?now=` etc. are how every hub page pins
      // its own deterministic state (see each page's own doc comment) — a
      // locale-follow redirect that dropped them would silently reset that
      // state on every language change, not just move the URL.
      const query = toQueryString(searchParams);
      redirect({ href: query ? `${href}?${query}` : href, locale: targetLocale });
    }
    return principal;
  }

  if (principal?.kind === 'member') redirect({ href: '/today', locale });
  redirect({ href: '/hub/pair', locale });

  // `redirect()` throws; next-intl's wrapper is not typed `never`.
  throw new Error('unreachable');
}

function toQueryString(searchParams?: URLSearchParams | Record<string, string | undefined>) {
  if (!searchParams) return '';
  const entries =
    searchParams instanceof URLSearchParams
      ? [...searchParams.entries()]
      : Object.entries(searchParams).filter((entry): entry is [string, string] => entry[1] != null);

  return new URLSearchParams(entries).toString();
}
