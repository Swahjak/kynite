import type { NextConfig } from 'next';
import { withSerwist } from '@serwist/turbopack';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
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
