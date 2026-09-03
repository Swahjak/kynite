import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import createMiddleware from 'next-intl/middleware';
import { CALLBACK_URL_PARAM, sanitizeCallbackUrl } from '@/lib/callback-url';
import { DEVICE_SESSION_COOKIE } from '@/lib/device-session';
import { routing } from '@/i18n/routing';

// Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`.
const intl = createMiddleware(routing);

/**
 * First URL segment (after the locale) of every `(app)` route: the parent PWA,
 * which requires an account session (docs/architecture.md §2).
 */
const PROTECTED_SECTIONS = new Set([
  'today',
  'calendar',
  'routines',
  'rewards',
  'family',
  'settings',
  // M-C: `(app)/oauth/consent` — the MCP/OAuth-provider consent screen. The
  // layout guard is authoritative (same split as every other section here);
  // this is the same cheap early bounce.
  'oauth',
]);

function isLocale(segment: string | undefined): segment is (typeof routing.locales)[number] {
  return routing.locales.includes(segment as (typeof routing.locales)[number]);
}

/** The kiosk tree's own first segment (M12). */
const HUB_SECTION = 'hub';

/** The caregiver share tree's first segment — `(share)/s/[token]` (M13). */
const SHARE_SECTION = 's';

/**
 * The second-parent invite tree's first segment — `(auth)/invite/[token]`
 * (M14, PRD FR26).
 *
 * Carries the same `SHARE_HEADERS` as `(share)` and for the identical reason:
 * the raw token lives in the URL itself, so an indexed link or a leaked
 * `Referer` is a leaked credential either way — here, one that grants a login
 * rather than a read. Unlike `(share)` it is **not** funnelled through the
 * `SAFE_METHODS` 405 guard below: this tree's Server Actions (`acceptInviteAction`,
 * `chooseProfileAction`) submit as `POST` to the page that rendered them, so
 * blocking non-GET here would break the flow it exists to protect.
 */
const INVITE_SECTION = 'invite';

/**
 * Headers every `(share)` response carries (M13 criterion).
 *
 * `X-Robots-Tag` rather than only a `<meta name="robots">`: the share layout
 * sets the meta tag too, but a crawler that follows a link from a WhatsApp
 * preview may never parse the body, and an indexed share URL is an indexed
 * bearer token. Belt and braces is the correct posture when the failure mode is
 * "the family schedule is on Google".
 *
 * `Referrer-Policy: no-referrer` is the more important of the two. The token is
 * *in the path*, so any outbound request from this page — a stylesheet on a
 * CDN, a link a caregiver taps, an image — would otherwise put the full URL in
 * a `Referer` header on somebody else's server. The share view has no external
 * requests today; the header is what keeps that a design decision rather than a
 * standing hazard.
 */
const SHARE_HEADERS: Record<string, string> = {
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  // A share page rendered from a shared cache would be one family's schedule
  // served to whoever asks next. `force-dynamic` already says so to Next; this
  // says it to every proxy in between.
  'Cache-Control': 'no-store',
};

/** Reads only. Everything else from this tree is a mutation attempt. */
const SAFE_METHODS = new Set(['GET', 'HEAD']);

/**
 * Personal-use deployment, not a public product: every response — not just
 * `(share)`/`invite` — gets `X-Robots-Tag: noindex, nofollow`. Header rather
 * than only the `<meta>` in `[locale]/layout.tsx`, same reasoning as
 * `SHARE_HEADERS` above — a crawler that never parses the body still reads
 * this.
 */
function noIndex(response: NextResponse): NextResponse {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

/**
 * Optimistic guard: a missing session cookie is turned away here so the tree
 * behind it is never even rendered. Cookie *presence* is not proof of a
 * session — `(app)/layout.tsx` and `requireHubDevice()` re-check against the
 * database and are authoritative. Both checks exist because the cheap one
 * saves a render and the expensive one is the one that is true.
 *
 * The two trees are mirror images: `(app)` needs an *account* cookie and
 * bounces to sign-in without one; `(hub)` needs a *device* cookie and bounces
 * to the pair screen without one. `/hub/pair` is exempt for the obvious reason
 * — it is where the device cookie comes from.
 */
export default function proxy(request: NextRequest): NextResponse {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  const locale = isLocale(segments[0]) ? segments[0] : routing.defaultLocale;
  const rest = isLocale(segments[0]) ? segments.slice(1) : segments;
  const section = rest[0];

  /**
   * The `(share)` tree (M13, docs/architecture.md §2: "must be impossible to
   * reach a mutation from this tree").
   *
   * This runs **first**, and it is a hard refusal rather than a redirect. A
   * Server Action invocation is a `POST` to the URL of the page that rendered
   * it, so refusing every non-GET request to `/s/*` closes the mutation path at
   * the transport, underneath whatever the route tree happens to import. The
   * lint rule and `tests/unit/share-tree-no-server-actions.test.ts` stop an
   * action from being imported at all; this stops one from being *invoked* even
   * if both were somehow wrong. Three independent mechanisms, because the thing
   * being protected is a household's data behind a URL anybody may hold.
   *
   * A contributor's tick is not affected: it goes to
   * `POST /api/share/completions`, which this proxy never sees — the matcher
   * skips `api/` — and which re-derives the principal from the token itself.
   */
  if (section === SHARE_SECTION) {
    if (!SAFE_METHODS.has(request.method)) {
      return noIndex(new NextResponse(null, { status: 405, headers: { Allow: 'GET, HEAD' } }));
    }

    const response = intl(request);
    for (const [key, value] of Object.entries(SHARE_HEADERS)) response.headers.set(key, value);
    return noIndex(response);
  }

  /**
   * F3: the invite tree gets the same `noindex` / `no-referrer` / `no-store`
   * headers as `(share)`, headers only — no method restriction (see
   * `INVITE_SECTION`).
   */
  if (section === INVITE_SECTION) {
    const response = intl(request);
    for (const [key, value] of Object.entries(SHARE_HEADERS)) response.headers.set(key, value);
    return noIndex(response);
  }

  if (section && PROTECTED_SECTIONS.has(section) && !getSessionCookie(request)) {
    const url = request.nextUrl.clone();
    const intended = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    url.pathname = `/${locale}/sign-in`;
    // M18: the sign-in URL starts with an empty query — the intended URL's
    // parameters have no business sitting loose on the sign-in form — and the
    // whole intended destination, *query string included*, is then carried
    // across inside `?callbackUrl=`. Preserving it is the point: a parent
    // deep-linked to `/today?date=2026-08-14` has to land back on that day and
    // not on today. It is re-validated as a relative path on the
    // way out (`lib/callback-url.ts`), which is what keeps a value this proxy
    // wrote and a value an attacker put in a link indistinguishable *and*
    // harmless.
    url.search = '';
    const callbackUrl = sanitizeCallbackUrl(intended);
    if (callbackUrl && callbackUrl !== `/${locale}/sign-in`) {
      url.searchParams.set(CALLBACK_URL_PARAM, callbackUrl);
    }
    return noIndex(NextResponse.redirect(url));
  }

  if (
    section === HUB_SECTION &&
    rest[1] !== 'pair' &&
    !request.cookies.has(DEVICE_SESSION_COOKIE) &&
    // A signed-in parent is not redirected from here: `requireHubDevice()`
    // sends them to their own surface instead, and it is the only one of the
    // two that can tell a member principal from an unpaired tablet.
    !getSessionCookie(request)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/hub/pair`;
    url.search = '';
    return noIndex(NextResponse.redirect(url));
  }

  return noIndex(intl(request));
}

export const config = {
  // Skip API routes, Next internals, the internal /dev tooling routes (which
  // are not localised) and anything with a file extension. `.well-known` (the
  // M-C OAuth-provider discovery documents: RFC 8414/9728 authorization-server
  // and protected-resource metadata) is already unreachable here because
  // `.*\..*` matches any path containing a literal dot — `.well-known` is one
  // — but it is named explicitly too: those endpoints MUST stay public and
  // unlocalised, and that must not depend on a side effect of the extension
  // exclusion.
  matcher: '/((?!api|dev|_next|_vercel|\\.well-known|.*\\..*).*)',
};
