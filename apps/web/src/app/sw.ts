/// <reference lib="webworker" />
import {
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
} from 'serwist';
import {
  APP_NETWORK_TIMEOUT_SECONDS,
  CACHE,
  HUB_NETWORK_TIMEOUT_SECONDS,
  HUB_SHELL_MAX_AGE_SECONDS,
  isHubUrl,
  strategyFor,
} from '@/components/offline/sw-strategy';
import { RELOAD_HUB_MESSAGE } from '@/components/offline/reload-gate';

/**
 * The Kynite service worker (docs/architecture.md §6, milestone M11).
 *
 * **One worker, two surfaces.** §6: "one Serwist service worker with
 * scope-aware runtime rules (a single SW is simpler than juggling two scopes,
 * and `/hub` vs `/app` route matching is enough to differentiate)". The
 * matching itself lives in `@/components/offline/sw-strategy`, which is pure
 * and unit-tested; everything here is the wiring that turns a strategy name
 * into a Serwist route.
 *
 * | Surface | Pages | Why |
 * |---|---|---|
 * | hub | precache + `NetworkFirst` (2s → cache) | a kiosk must boot to something useful with no network — see `HUB_NETWORK_TIMEOUT_SECONDS` for why this is not §6's literal `StaleWhileRevalidate` |
 * | parent app | `NetworkFirst` (3s → cache) | mobile is in-the-moment; freshness beats offline |
 * | assets both | `CacheFirst` | immutable, and celebrations must never wait on a network |
 *
 * **Update handling.** `skipWaiting` is on — a new build takes over the worker
 * immediately — but `clientsClaim` is *off* and there is no automatic reload.
 * The worker only *posts* `RELOAD_HUB`; whether the page acts on it is decided
 * by `reload-gate.ts` on the client, because only the page knows whether a
 * child is standing in front of it. A deploy must never interrupt a morning
 * routine (§6 "Long-run hygiene").
 *
 * This file is bundled by esbuild via `@serwist/turbopack`'s route handler
 * (`src/app/serwist/[path]/route.ts`), not by Next's own compiler, and is
 * typechecked by `tsconfig.sw.json` (a service worker needs the `webworker`
 * lib, which conflicts with `dom` in the app's config).
 */

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** Only ever cache a 200 — an opaque or partial response would poison the shell. */
const cacheableOnly = new CacheableResponsePlugin({ statuses: [200] });

const runtimeCaching: RuntimeCaching[] = [
  {
    // §6 hub: "App shell — precache + StaleWhileRevalidate", implemented as
    // network-first with a two-second fuse. `HUB_NETWORK_TIMEOUT_SECONDS`
    // carries the whole argument: a stale board paints a wrong countdown.
    matcher: ({ request, url }) =>
      strategyFor({ url, destination: request.destination, mode: request.mode }) === 'hub-shell',
    handler: new NetworkFirst({
      cacheName: CACHE.hubShell,
      networkTimeoutSeconds: HUB_NETWORK_TIMEOUT_SECONDS,
      plugins: [
        cacheableOnly,
        new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: HUB_SHELL_MAX_AGE_SECONDS }),
      ],
    }),
  },
  {
    // §6 parent mobile: "NetworkFirst (3s timeout to cache) for pages and data".
    matcher: ({ request, url }) =>
      strategyFor({ url, destination: request.destination, mode: request.mode }) === 'app-pages',
    handler: new NetworkFirst({
      cacheName: CACHE.appPages,
      networkTimeoutSeconds: APP_NETWORK_TIMEOUT_SECONDS,
      plugins: [cacheableOnly, new ExpirationPlugin({ maxEntries: 64 })],
    }),
  },
  {
    // §6 both: "Fonts, icons, celebration assets — CacheFirst".
    matcher: ({ request, url }) =>
      strategyFor({ url, destination: request.destination, mode: request.mode }) === 'assets',
    handler: new CacheFirst({
      cacheName: CACHE.assets,
      plugins: [
        cacheableOnly,
        new ExpirationPlugin({ maxEntries: 128, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      ],
    }),
  },
  {
    // JSON the hub polls. `NetworkFirst` so a reachable server always wins;
    // the cache is only what keeps a board rendering while the wifi is out.
    matcher: ({ request, url }) =>
      strategyFor({ url, destination: request.destination, mode: request.mode }) === 'data',
    handler: new NetworkFirst({
      cacheName: CACHE.data,
      networkTimeoutSeconds: APP_NETWORK_TIMEOUT_SECONDS,
      plugins: [cacheableOnly, new ExpirationPlugin({ maxEntries: 32 })],
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // A new build activates immediately; see the header — activating is not
  // reloading, and only the page decides the latter.
  skipWaiting: true,
  clientsClaim: false,
  navigationPreload: true,
  runtimeCaching,
});

serwist.addEventListeners();

/**
 * Documents cached by the *previous* build, dropped the moment this one is
 * authoritative.
 *
 * `kynite-hub-shell-v1` and `kynite-app-pages-v1` hold rendered HTML, and
 * rendered HTML names the content-hashed chunks of the build that produced it.
 * A deploy retires those chunk names twice over: the origin serves only the
 * new build's files, and Serwist's precache cleanup — which runs in this same
 * activation — deletes the old ones from `serwist-precache-v2`. So from here
 * on, a cached document from the previous build is not a stale board, it is an
 * *unbootable* one: it would paint, then fail on its first missing chunk.
 *
 * Serving it is therefore never the better answer, including offline, where
 * the alternative was already a page that could not finish loading. The cost
 * is a single window — between this activation and the next successful
 * navigation — in which a hub that goes offline has no cached document. The
 * reload gate closes that window within minutes on an idle board, and any
 * online navigation closes it at once.
 *
 * `CACHE.assets` is deliberately not touched: it is content-hashed build
 * output and principal-free art, where an old entry is inert rather than
 * wrong, and refilling it is the expensive one (§6, "celebrations must never
 * wait on a network"). `CACHE.data` stays for the same reason — JSON is not
 * bound to a build.
 */
async function dropPreviousBuildDocuments(): Promise<void> {
  await Promise.all([caches.delete(CACHE.hubShell), caches.delete(CACHE.appPages)]);
}

/**
 * Tell the hub (and only the hub) that a new build is waiting.
 *
 * Posted on `activate`, which is the first moment the new worker is
 * authoritative. Every hub client gets `{ type: 'RELOAD_HUB' }` and each one
 * runs the same gate against its own idle clock — a board in the kitchen and
 * one in the hallway can legitimately reload at different times.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await dropPreviousBuildDocuments();

      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        if (!isHubUrl(client.url)) continue;
        client.postMessage({ type: RELOAD_HUB_MESSAGE, at: new Date().toISOString() });
      }
    })()
  );
});

/**
 * Web push (§6 step 5).
 *
 * The payload is produced by `modules/notifications/copy.ts`, already
 * localized and already in the neutral board voice. Nothing is invented here:
 * a push with no body is dropped rather than shown as a generic "Kynite"
 * notification, because a notification that says nothing is pure noise.
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; url?: string; tag?: string };
  try {
    payload = event.data.json() as typeof payload;
  } catch {
    return;
  }

  if (!payload.title || !payload.body) return;

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // `tag` groups a re-send onto the same notification instead of stacking
      // a second one — the lock-screen equivalent of not nagging.
      tag: payload.tag,
      data: { url: payload.url ?? '/' },
      // Reminders are ambient information, not alarms.
      requireInteraction: false,
      silent: false,
    })
  );
});

/** §6 step 5: "`notificationclick` deep-links into `(app)`". */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = (event.notification.data as { url?: string } | undefined)?.url ?? '/';

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Focus an open tab on the same origin rather than opening a third copy
      // of the app on a parent's phone.
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
