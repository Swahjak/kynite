import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * The e2e server talks to the throwaway database from `pnpm e2e:setup` (5435),
 * never to the developer's dev database (5433) — auth specs write real rows.
 * The auth secret is generated per run: nothing to commit, nothing to leak.
 */
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://kynite:kynite@localhost:5435/kynite_test';
const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET ?? randomBytes(32).toString('base64');

// Specs that decode the signed session cookie need the same secret the server
// booted with; workers inherit this env from the config process.
process.env.BETTER_AUTH_SECRET = BETTER_AUTH_SECRET;
process.env.E2E_DATABASE_URL = DATABASE_URL;

export default defineConfig({
  testDir: './e2e/tests',
  outputDir: './e2e/test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { outputFolder: './e2e/playwright-report', open: 'never' }]],
  expect: {
    toHaveScreenshot: {
      // Two bounds, not one (M02 carry-forward). The ratio alone scales with
      // the screenshot: 1% of a full-page design system page is tens of
      // thousands of pixels, enough to hide a genuinely broken component. The
      // absolute cap is what keeps a large page honest; the ratio is what
      // keeps a small one from failing on a single antialiased edge.
      maxDiffPixels: 400,
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    },
  },
  use: {
    baseURL,
    // Deterministic Accept-Language: next-intl negotiates the locale from it,
    // so without this the default-locale assertions depend on the CI machine.
    locale: 'nl-NL',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // F14a: the completion-perf guard lives in its own project (below) so it
      // never shares a worker pool with this one.
      testIgnore: '**/realtime/completion-perf.spec.ts',
    },
    /**
     * F14a: `completion-perf.spec.ts` measures the <100ms optimistic-completion
     * NFR in real milliseconds inside the page (`performance.now()`), against a
     * fixed 100ms budget that is meant to fail the build on a genuine
     * regression. That budget is a property of the *code path*, not of the
     * machine — but it was measured on a machine, and this repo's default run
     * is `fullyParallel: true` with no worker cap, so up to 4 Chromium
     * instances contend for the same CPU. Under that contention the spec
     * measured 159ms 4/4 runs: a real machine-load artefact, not a code
     * regression, and not something the budget should be loosened to
     * accommodate (loosening it would just move the same false floor
     * elsewhere).
     *
     * `test.describe.configure({ mode: 'serial' })` was considered and
     * rejected: it only orders tests *within* the same worker/file, it does
     * not stop the other project's workers from running concurrently on the
     * same box. A separate project with `workers: 1` and `dependencies:
     * ['chromium']` is what actually isolates it — Playwright runs a project's
     * dependencies to completion before starting the project itself, so this
     * one starts only once every `chromium` worker has exited and has the
     * machine to itself.
     */
    {
      name: 'chromium-perf',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/realtime/completion-perf.spec.ts',
      fullyParallel: false,
      workers: 1,
      dependencies: ['chromium'],
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    env: {
      DATABASE_URL,
      BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: baseURL,
      // A per-run token key: the Google slice validates it at boot, and no
      // secret should ever be committed for the e2e database.
      TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
      // No background workers under test: pg-boss would install its schema in
      // the throwaway database and add timing nondeterminism for nothing —
      // every spec drives the app through HTTP (docs/architecture.md §10).
      JOBS_ENABLED: 'false',
    },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
