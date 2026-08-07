import type { NextConfig } from 'next';
import { withSerwist } from '@serwist/turbopack';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  /**
   * M17: the e2e run boots a *second* dev server — same app, but with Google
   * credentials pointed at the fake Google (see `playwright.config.ts`). Next
   * refuses two dev servers in one project directory because they would share
   * `.next/dev`, so the second one is given its own build directory through
   * this variable. Unset everywhere else, which is every other invocation.
   */
  distDir: process.env.NEXT_DIST_DIR || '.next',
  /**
   * The dev overlay is off under e2e (M17).
   *
   * It renders a fixed portal in the bottom-left corner, which on the `app`
   * project's 390×844 viewport sits exactly on top of the mobile bottom nav
   * and swallows the clicks. That is a property of the *tooling*, not of the
   * product, and `settlePage` already hides it for screenshots — this hides it
   * for pointer events too, where CSS injected after load is too late.
   */
  devIndicators: process.env.E2E === 'true' ? false : undefined,
  reactStrictMode: true,
  typedRoutes: true,
  // Playwright drives the dev server over 127.0.0.1.
  allowedDevOrigins: ['127.0.0.1'],
  // `web-push` is a CommonJS package with native-ish crypto usage; bundling it
  // into a server chunk breaks its `require` graph.
  serverExternalPackages: ['web-push'],
  async headers() {
    return [
      {
        // A stale service worker is a deploy that never reaches the wall
        // (docs/architecture.md §6 "Long-run hygiene"). `updateViaCache:
        // 'none'` on the registration says the same thing from the other side.
        source: '/serwist/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

// `withSerwist` only adds `esbuild` to `serverExternalPackages` — the worker is
// built by `src/app/serwist/[path]/route.ts`, not by a bundler plugin, because
// Next 16 builds with Turbopack and `@serwist/next` is a webpack plugin.
export default withSerwist(withNextIntl(nextConfig));
