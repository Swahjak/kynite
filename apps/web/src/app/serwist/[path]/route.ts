import { createSerwistRoute } from '@serwist/turbopack';

/**
 * Builds and serves the service worker (docs/architecture.md §6, M11).
 *
 * **Why a route and not a static file.** `next build` runs on Turbopack in
 * Next 16, and `@serwist/next` is a *webpack* plugin — it has nothing to hook
 * into. `@serwist/turbopack` inverts the integration: the worker is bundled by
 * esbuild on demand and served from this handler, with `dynamic:
 * 'force-static'` so the production build renders it once, exactly like a
 * static asset. The precache manifest is generated from the real build output
 * (`.next` + `public/`) at that moment, which is the part a hand-rolled
 * `public/sw.js` could not do without reimplementing it.
 *
 * The handler sets `Service-Worker-Allowed: /` on its responses, which is what
 * lets a worker served from `/serwist/sw.js` claim the whole origin — both
 * `(hub)` and `(app)` (§6: one worker, two surfaces).
 *
 * `src/proxy.ts` never sees these URLs: its matcher excludes anything with a
 * file extension, and `/serwist/sw.js` has one.
 */
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    swSrc: 'src/app/sw.ts',
    // The native binary rather than the wasm build: this repo already has
    // esbuild as a dev dependency and the native one is several times faster on
    // a cold `next build`.
    useNativeEsbuild: true,
    // The precache manifest. `public/` art and the built app shell; the hub
    // document itself is cached at runtime (`StaleWhileRevalidate`) because it
    // is server-rendered per family and cannot be precached usefully.
    globDirectory: '.',
    globPatterns: [
      'public/icons/**/*.png',
      'public/*.svg',
      'public/*.webmanifest',
      '.next/static/**/*.{js,css,woff2}',
    ],
  }
);
