import path from 'node:path';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import type { NextConfig } from 'next';
import { withSerwist } from '@serwist/turbopack';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * The ESM half of `@swc/helpers`, as a trace-include pattern (see
 * `outputFileTracingIncludes` below).
 *
 * Resolved through `next` rather than from here, because `@swc/helpers` is
 * *next's* dependency: under pnpm it exists only inside next's own
 * `node_modules`, and that symlink is the copy the server will load. The
 * realpath turns it back into the store directory the standalone tree
 * actually mirrors, so the glob does not have to walk a symlink.
 */
const require = createRequire(import.meta.url);
const swcHelpersEsmGlob = `${path.relative(
  import.meta.dirname,
  realpathSync(
    path.dirname(
      require.resolve('@swc/helpers/package.json', {
        paths: [path.dirname(require.resolve('next/package.json'))],
      })
    )
  )
)}/esm/**`;

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
  /**
   * M18: the deploy target is a container (Railway), so the build has to emit
   * a self-contained server — `.next/standalone/server.js` plus a traced
   * `node_modules` — rather than something that needs the repo and a full
   * install beside it. The output is *additive*: `next start` and the e2e run
   * keep working off `.next/` exactly as before.
   */
  output: 'standalone',
  /**
   * `@kynite/ui` exports TypeScript *source*, not a build artefact (see its
   * package.json). Next therefore has to compile it as if it were part of the
   * app — which is exactly what `transpilePackages` means.
   */
  transpilePackages: ['@kynite/ui'],
  /**
   * Ship the ESM build of `@swc/helpers` with the standalone output.
   *
   * Next's own CJS runtime (`next/dist/shared/lib/constants.js` and a hundred
   * others) does `require('@swc/helpers/_/_interop_require_default')`. That
   * subpath's `exports` map lists `module-sync` before `default`, so Node
   * ≥22.12 — where `require(esm)` is on — resolves it to `esm/*.js`, while the
   * file tracer follows `default` and copies only `cjs/*.cjs`. The traced
   * server then dies at boot on the very first require:
   *
   *   Error: Cannot find module '…/@swc/helpers/esm/_interop_require_default.js'
   *
   * It is a packaging gap, not a code path: nothing in this app imports the
   * helpers. Including the directory is ~250 files of a few hundred bytes each.
   * Remove this once the tracer resolves `module-sync` the way Node does.
   */
  outputFileTracingIncludes: {
    '/**': [swcHelpersEsmGlob],
  },
  reactStrictMode: true,
  typedRoutes: true,
  /**
   * TypeScript 7 dropped the JavaScript compiler API (it returns in 7.1), so
   * the `typescript` *package* here is the official `@typescript/typescript6`
   * compat shim — typescript-eslint and the two AST tests need that API. The
   * native TS7 compiler is installed alongside as `typescript-native`, and it
   * is what plain `tsc` (so `pnpm typecheck`) runs.
   *
   * By default `next build` type-checks by shelling out to the `tsc` binary
   * declared by the `typescript` package itself — but the compat shim only
   * declares `tsc6`, so that lookup fails with "typescript is not installed".
   * Opting out puts `next build` back on the compiler API, which the shim does
   * provide. The build is still fully type-checked; only this step runs on the
   * TS6 checker rather than the native one. Revisit when TS 7.1 restores the
   * API and typescript-eslint supports it — then `typescript` can just be 7.
   */
  experimental: {
    useTypeScriptCli: false,
  },
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
