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
