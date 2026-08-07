/**
 * Which caching strategy a request belongs to (docs/architecture.md §6).
 *
 * One service worker serves both surfaces — §6: "a single SW is simpler than
 * juggling two scopes, and `/hub` vs `/app` route matching is enough to
 * differentiate" — so the differentiation is a URL predicate, and a URL
 * predicate is worth being able to test without a browser. `src/app/sw.ts`
 * imports these and does nothing else with routing.
 *
 * Pure: no `self`, no `caches`, no DOM. It is imported by the service worker
 * (bundled by esbuild) *and* by the unit suite (Node), so it must be neither.
 */

/** Locale prefixes `localePrefix: 'always'` puts on every page URL. */
export const LOCALES = ['nl', 'en'] as const;

/** Cache names, versioned so a strategy change cannot read a stale shape. */
export const CACHE = {
  hubShell: 'kynite-hub-shell-v1',
  appPages: 'kynite-app-pages-v1',
  assets: 'kynite-assets-v1',
  data: 'kynite-data-v1',
} as const;

/**
 * §6 "Parent mobile": `NetworkFirst` (3s timeout to cache). Mobile is
 * in-the-moment; a three-second wait is the point at which last-week's page is
 * better than no page.
 */
export const APP_NETWORK_TIMEOUT_SECONDS = 3;

/**
 * The hub's own navigation timeout — **a deliberate deviation from §6, which
 * specifies `StaleWhileRevalidate` for the hub shell.**
 *
 * SWR paints the previous response instantly and refreshes the cache behind
 * it. For a static shell that is exactly right. For this hub it is not: the
 * board is server-rendered per family and carries `serverNow`, the instant
 * every countdown on the wall is derived from. Serving a stale document
 * therefore paints a *wrong countdown* until the next poll corrects it — which
 * regresses M09's proven criterion that "reloading the hub mid-countdown
 * resumes at the correct remaining time (±1s)".
 *
 * So hub navigations are `NetworkFirst` with a two-second fuse instead. The
 * guarantee §6 actually wanted is unchanged and is the one M11 states: with
 * the network disabled the fetch fails at once and the cached board is on the
 * wall immediately. What changes is only the *online* case, where the hub now
 * shows the truth rather than the most recent truth.
 *
 * The other two hub rows of §6 are untouched: the app shell is precached, and
 * fonts/icons/celebration assets are `CacheFirst`.
 */
export const HUB_NETWORK_TIMEOUT_SECONDS = 2;

/** How long a cached hub document stays useful. A week of wall time, per PRD FR21. */
export const HUB_SHELL_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function pathOf(url: URL | string): string {
  return typeof url === 'string' ? new URL(url, 'http://x').pathname : url.pathname;
}

/**
 * A hub URL: `/{locale}/hub` and everything under it.
 *
 * Matched on the *path*, not on a referrer or a client id, because the same
 * service worker instance serves both surfaces and only the URL is reliable
 * for a navigation preload or a cold boot.
 */
export function isHubUrl(url: URL | string): boolean {
  const path = pathOf(url);
  return LOCALES.some((locale) => path === `/${locale}/hub` || path.startsWith(`/${locale}/hub/`));
}

/**
 * Immutable build output and static art. §6: fonts, icons and celebration
 * assets are `CacheFirst` — "celebrations must never wait on a network".
 *
 * `/_next/static/*` is content-hashed, so "immutable" is literally true; the
 * `public/` art below is versioned by deploy and revalidated by the precache
 * manifest rather than by a request.
 */
export function isImmutableAsset(url: URL | string): boolean {
  const path = pathOf(url);
  return (
    path.startsWith('/_next/static/') ||
    path.startsWith('/icons/') ||
    path.startsWith('/avatars/') ||
    path.startsWith('/images/') ||
    /\.(?:woff2?|ttf|otf|png|jpe?g|svg|webp|avif|ico)$/.test(path)
  );
}

/**
 * Endpoints that must never be served from a cache.
 *
 * The stream is the obvious one — a cached `text/event-stream` would be a hub
 * that thinks it is connected forever, and §6 derives the *offline indicator*
 * from exactly that connection state. Auth and mutations are here for the
 * ordinary reason.
 */
export function isNeverCached(url: URL | string): boolean {
  const path = pathOf(url);
  return (
    path.startsWith('/api/sse') ||
    path.startsWith('/api/auth') ||
    path.startsWith('/api/push') ||
    path.startsWith('/api/webhooks')
  );
}

/** JSON reads the hub polls (the timer board). Cached only as a last resort. */
export function isDataRequest(url: URL | string): boolean {
  const path = pathOf(url);
  return path.startsWith('/api/') && !isNeverCached(path);
}

export type CacheStrategy = 'hub-shell' | 'app-pages' | 'assets' | 'data' | 'network-only';

/**
 * The whole routing table, as one function.
 *
 * `destination` comes from the `Request`; it is what distinguishes a *document*
 * from the RSC payload fetch that follows it, and both want the same strategy
 * per surface, which is why it collapses to "is this a page request".
 */
export function strategyFor(input: {
  url: URL | string;
  destination?: string;
  mode?: string;
}): CacheStrategy {
  if (isNeverCached(input.url)) return 'network-only';
  if (isImmutableAsset(input.url)) return 'assets';
  if (isDataRequest(input.url)) return 'data';

  const isPage = input.destination === 'document' || input.mode === 'navigate';
  if (!isPage && input.destination !== '' && input.destination !== undefined) {
    // A script/style/font that slipped past `isImmutableAsset` (a dev-mode
    // chunk, say) is still an asset, not a page.
    return 'assets';
  }

  // The hub boots from cache the moment the network is unreachable; the
  // parent app gets a longer fuse. See `HUB_NETWORK_TIMEOUT_SECONDS` for why
  // the hub is not `StaleWhileRevalidate`.
  return isHubUrl(input.url) ? 'hub-shell' : 'app-pages';
}
