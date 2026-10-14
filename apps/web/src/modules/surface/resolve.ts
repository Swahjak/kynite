/** Which of three UI surfaces a request should render as (H2a). */
export type Surface = 'app' | 'desktop' | 'hub';

export const SURFACE_COOKIE = 'kynite.surface';

/** The only two values a member may pick and have honoured; anything else (including 'hub') is ignored. */
export type SurfaceCookieValue = 'app' | 'desktop';

export type ResolveSurfaceInput = {
  /** Was the request principal a paired device? */
  isDevicePrincipal: boolean;
  /** Raw `kynite.surface` cookie value, or undefined/null if absent. */
  cookieValue: string | null | undefined;
  /** `Sec-CH-UA-Mobile` request header value, e.g. '?1' or '?0', or null/undefined if absent. */
  secChUaMobile: string | null | undefined;
  /** Raw `User-Agent` request header, or null/undefined if absent. */
  userAgent: string | null | undefined;
};

/**
 * Resolve the surface a request renders as, in a fixed order with the first
 * match winning (docs/plans/2026-09-15-hub-equals-app.md, H2a):
 *
 *  1. A paired device always renders the hub — the wall tablet is a kiosk, and
 *     no cookie preference can steer it elsewhere.
 *  2. A member's explicit surface cookie is honoured only for `'app'` and
 *     `'desktop'`; any other value is ignored so a stale or hand-edited cookie
 *     cannot force a surface the owner hasn't sanctioned.
 *  3. With no cookie signal, headers decide: a mobile client-hint, or a phone
 *     user-agent, means `'app'`; anything else defaults to `'desktop'`.
 */
export function resolveSurface(input: ResolveSurfaceInput): Surface {
  if (input.isDevicePrincipal) return 'hub';

  if (input.cookieValue === 'app') return 'app';
  if (input.cookieValue === 'desktop') return 'desktop';

  if (input.secChUaMobile === '?1') return 'app';

  if (input.userAgent != null) {
    // Tablet UAs (iPad, Android sans "Mobile") deliberately fall through to 'desktop' — see H2a digest.
    const phonePattern = /iphone|android.*mobile|windows phone|mobile safari/i;
    if (phonePattern.test(input.userAgent)) return 'app';
  }

  return 'desktop';
}

/**
 * Maps the resolved surface onto the existing `'app' | 'hub'` presentation prop
 * used by page-header/today/calendar UI. `desktop` renders like `hub` for now
 * (owner decision, H2a).
 */
export type Presentation = 'app' | 'hub';

const PRESENTATION: Record<Surface, Presentation> = {
  app: 'app',
  desktop: 'hub',
  hub: 'hub',
};

export function presentationFor(surface: Surface): Presentation {
  return PRESENTATION[surface];
}
