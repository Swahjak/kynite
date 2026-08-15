import { routing } from '@/i18n/routing';

/**
 * `?callbackUrl=` — "where I was going before you asked me to sign in" (M18).
 *
 * `src/proxy.ts` used to throw the query string away (`url.search = ''`) when
 * it bounced a cookie-less request to the sign-in form, so a parent who tapped
 * a link to `/nl/settings/google` from an email landed on `/nl/family` and had
 * to find their way back. This is the round trip, and the whole of its security
 * argument lives in `sanitizeCallbackUrl`.
 *
 * **Relative paths only.** The parameter is attacker-controllable by
 * construction — anybody can send a household a link with any `callbackUrl` on
 * it — so an absolute URL is an open redirect and a protocol-relative one
 * (`//evil.example`) is the same thing wearing a slash. Both are refused here
 * rather than anywhere downstream: this function is the only thing that decides
 * whether a callback is usable, and it fails closed to `null`, which every
 * caller reads as "use the default destination".
 */

/** The parameter's name, in one place — proxy, sign-in page and action agree. */
export const CALLBACK_URL_PARAM = 'callbackUrl';

/**
 * `null` unless `value` is a same-origin *path*: it must start with a single
 * `/`, must not start with `//` or `/\` (both of which browsers resolve as
 * protocol-relative authorities), and must carry no control characters (a raw
 * newline in a `Location` header is a response-splitting primitive).
 */
export function sanitizeCallbackUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

/**
 * A sanitized callback, minus its locale prefix — the shape
 * `@/i18n/navigation`'s `redirect({ href, locale })` wants, since it adds the
 * prefix back itself (`localePrefix: 'always'`).
 *
 * `/nl/settings/google?tab=x` → `/settings/google?tab=x`; a path with no
 * recognisable locale segment is returned unchanged, and `/nl` alone becomes
 * `/`.
 */
export function withoutLocalePrefix(path: string): string {
  const match = /^\/([^/?#]+)(?=[/?#]|$)/.exec(path);
  const segment = match?.[1];
  if (!segment || !routing.locales.includes(segment as (typeof routing.locales)[number])) {
    return path;
  }

  const rest = path.slice(match[0].length);
  return rest.startsWith('/') || rest.length === 0 ? rest || '/' : `/${rest}`;
}
