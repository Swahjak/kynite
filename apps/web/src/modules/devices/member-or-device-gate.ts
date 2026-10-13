import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import { locales, routing } from '@/i18n/routing';
import { CALLBACK_URL_PARAM } from '@/lib/callback-url';
import { DEVICE_SESSION_COOKIE } from '@/lib/device-session';
import { getFamily, getPrincipal, type Principal } from '@/modules/family';

/**
 * The `(main)` tree's authorization gate (H3, docs/plans/2026-09-15-hub-equals-app.md).
 *
 * One route tree now serves both a member and a paired device, so the gate
 * that used to be "a hub page requires a device" is "a shared page requires
 * *someone*". Called at the top of every `(main)` page rather than once in the
 * layout, for the same reason `requireHubDevice` documents: Next.js layouts do
 * not re-render on client-side navigation, so a check placed there runs once
 * per full page load and never again.
 *
 * Three ways in, two answers out:
 *
 *  - **a device principal** — the wall tablet. It follows the household
 *    language rather than the URL's (M16), exactly as `requireHubDevice` does,
 *    and lands back on its own route after the redirect.
 *  - **a member principal** — the signed-in parent. Allowed as-is; no locale
 *    follow, because a parent reads in their own language.
 *  - **no principal** — which of the two "not signed in" answers to give
 *    depends on which cookie the caller carries. A device cookie that no
 *    longer resolves (unpaired, revoked) is a kiosk and can only go to the
 *    pair screen; a browser with no device cookie is a member who is not
 *    signed in, and goes to sign-in. The pair screen (`/pair`) is the one
 *    surface that legitimately runs with no principal, and it does not call
 *    this gate — it keeps its own inverse gate instead.
 */
export async function requireMemberOrDevice(
  locale: string,
  href: string,
  searchParams?: URLSearchParams | Record<string, string | undefined>
): Promise<Principal> {
  const principal = await getPrincipal();

  if (principal?.kind === 'device') {
    /**
     * The wall display speaks the household's language, not the URL's (M16).
     *
     * Mirrors `requireHubDevice`'s device branch verbatim: `family.locale` is
     * the *household* setting, and a kiosk is the one surface with no person
     * behind it to hold a preference of their own. A redirect rather than an
     * override of the request locale, because `getLocale()` and every
     * `getTranslations()` resolve from the URL segment. `href` is the caller's
     * own route, so a deep page lands back on itself rather than on the board.
     */
    const family = await getFamily(principal.familyId);
    // NB-4: `family.locale` is unconstrained text at the column, not an enum —
    // a bad value here must not become an infinite redirect loop.
    const targetLocale =
      family && (locales as readonly string[]).includes(family.locale)
        ? family.locale
        : routing.defaultLocale;

    if (family && targetLocale !== locale) {
      const query = toQueryString(searchParams);
      redirect({ href: query ? `${href}?${query}` : href, locale: targetLocale });
    }
    return principal;
  }

  if (principal?.kind === 'member') return principal;

  // No principal: distinguish a kiosk with a stale device cookie from a
  // signed-out member. The cookie is read for *presence* only — whether it
  // resolves to a device is `getPrincipal()`'s job, and it already said no.
  const hasDeviceCookie = (await cookies()).has(DEVICE_SESSION_COOKIE);
  if (hasDeviceCookie) redirect({ href: '/pair', locale });
  // The proxy puts `callbackUrl` on the sign-in redirect; do the same here so a
  // session that expired mid-visit (cookie present, no principal) returns too.
  const query = toQueryString(searchParams);
  redirect({
    href: {
      pathname: '/sign-in',
      query: { [CALLBACK_URL_PARAM]: `/${locale}${href}${query ? `?${query}` : ''}` },
    },
    locale,
  });

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
