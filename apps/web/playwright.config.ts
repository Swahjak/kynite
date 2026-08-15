import { defineConfig, devices } from '@playwright/test';

import { APP_STORAGE_STATE, HUB_STORAGE_STATE, SHARE_STORAGE_STATE } from './e2e/support/paths';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const GOOGLE_PORT = Number(process.env.E2E_GOOGLE_PORT ?? 3101);
const FAKE_GOOGLE_PORT = Number(process.env.FAKE_GOOGLE_PORT ?? 3102);

const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
/** The same app, booted with Google credentials pointed at the fake (M17). */
const googleBaseURL = `http://127.0.0.1:${GOOGLE_PORT}`;
const fakeGoogleURL = `http://127.0.0.1:${FAKE_GOOGLE_PORT}`;

/**
 * The e2e server talks to the throwaway database from `pnpm e2e:setup` (5435),
 * never to the developer's dev database (5433) — auth specs write real rows.
 */
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://kynite:kynite@localhost:5435/kynite_test';
/**
 * Fixed, not random (M17).
 *
 * It used to be `randomBytes(32)` per config load, which is the right instinct
 * for a secret and the wrong one here: `reuseExistingServer` means a local run
 * frequently attaches to a dev server a *previous* run started, and that server
 * booted with the previous secret. Every session cookie it signs then fails to
 * decode in the worker — which surfaces as `cached!` throwing inside
 * `signUpFamily`, several layers away from the cause, and only sometimes.
 *
 * There is nothing to protect: this signs sessions for a throwaway database
 * that `pnpm e2e:teardown` deletes, on a server bound to 127.0.0.1. A real
 * secret can still be forced through the environment.
 */
const BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET ?? 'kynite-e2e-fixed-auth-secret-not-a-real-one-0123456789';
/** Fixed for the same reason as the auth secret above: server reuse. Env-overridable like BETTER_AUTH_SECRET above. */
const TOKEN_ENCRYPTION_KEY =
  process.env.TOKEN_ENCRYPTION_KEY ?? 'a3luaXRlLWUyZS10b2tlbi1rZXktMzJieXRlcyEhISE=';

// Specs that decode the signed session cookie need the same secret the server
// booted with; workers inherit this env from the config process.
process.env.BETTER_AUTH_SECRET = BETTER_AUTH_SECRET;
process.env.E2E_DATABASE_URL = DATABASE_URL;
process.env.E2E_GOOGLE_BASE_URL = googleBaseURL;

/** Viewports, named once so a spec can restate one without guessing it. */
export const HUB_VIEWPORT = { width: 1280, height: 800 } as const;
export const APP_VIEWPORT = { width: 390, height: 844 } as const;

const serverEnv = {
  DATABASE_URL,
  BETTER_AUTH_SECRET,
  TOKEN_ENCRYPTION_KEY,
  // No background workers under test: pg-boss would install its schema in
  // the throwaway database and add timing nondeterminism for nothing —
  // every spec drives the app through HTTP (docs/architecture.md §10).
  JOBS_ENABLED: 'false',
  // Turns off the Next dev overlay (see `next.config.ts`).
  E2E: 'true',
};

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  /**
   * One retry locally, two on CI.
   *
   * Not a tolerance for flaky *tests* — M17 fixed the ones this suite had, and
   * a spec that needs a retry to pass is a spec to fix. It is a tolerance for
   * the **dev server**: `pnpm dev` compiles routes on demand while four
   * workers hit it at once, and the serwist route builds the service worker by
   * globbing `.next/static` — which can read a chunk turbopack is still
   * writing and surface as `Unexpected end of JSON input` on whichever page
   * happened to be loading. It is not reproducible under repetition (18/18
   * green immediately after) and it is an artefact of the harness, not of the
   * product. M18 runs the suite against a built server, where it cannot
   * happen; until then, one retry is the proportionate answer.
   */
  retries: process.env.CI ? 2 : 1,
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
    /**
     * M17: pinned text rasterisation.
     *
     * The visual suite's residual flake class (carried forward from M15) was
     * antialiasing, not layout — the hub clock's large extrabold glyphs
     * landing a fraction of a pixel differently between runs and pushing a
     * full-page diff over the 400px cap. Subpixel positioning and LCD
     * (subpixel-RGB) text are the two sources of that: both make a glyph's
     * rasterisation depend on where it happens to land and on the compositing
     * path, which is not a property of the design under test. Turning them off
     * makes every run — and every machine — rasterise text the same way, which
     * is a real fix rather than a wider tolerance that would also hide real
     * regressions.
     */
    launchOptions: {
      args: [
        '--disable-lcd-text',
        '--disable-font-subpixel-positioning',
        '--font-render-hinting=none',
        '--force-color-profile=srgb',
      ],
    },
  },
  projects: [
    /**
     * Mints the three storage states below. Every surface project depends on
     * it, so it always runs first and exactly once.
     */
    {
      name: 'setup',
      testDir: './e2e/setup',
      testMatch: '**/*.setup.ts',
      use: { ...devices['Desktop Chrome'] },
    },

    /**
     * The parent app: a phone, signed in.
     *
     * 390×844 because that is where FR-level parent use happens — a parent
     * approving a reward is holding a phone, not sitting at a desk — and
     * because the mobile layout is the one that can actually break (M15's
     * header overflow was found exactly this way).
     */
    {
      name: 'app',
      testDir: './e2e/tests/app',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: APP_VIEWPORT,
        storageState: APP_STORAGE_STATE,
      },
    },

    /**
     * The wall display: a 1280×800 tablet holding a device session and no
     * account at all.
     */
    {
      name: 'hub',
      testDir: './e2e/tests/hub',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: HUB_VIEWPORT,
        storageState: HUB_STORAGE_STATE,
      },
      // The completion-perf guard runs alone, in `perf` below.
      testIgnore: '**/realtime/completion-perf.spec.ts',
    },

    /**
     * The caregiver's browser: a phone that has never signed in to anything.
     * The empty storage state is written explicitly by `setup` so "no session"
     * is asserted, not assumed.
     */
    {
      name: 'share',
      testDir: './e2e/tests/share',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: APP_VIEWPORT,
        storageState: SHARE_STORAGE_STATE,
      },
    },

    /**
     * F14a (kept verbatim through M17's reorganisation):
     * `completion-perf.spec.ts` measures the <100ms optimistic-completion NFR
     * in real milliseconds inside the page (`performance.now()`), against a
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
     * not stop the other projects' workers from running concurrently on the
     * same box. A separate project with `workers: 1` and dependencies on every
     * other project is what actually isolates it — Playwright runs a project's
     * dependencies to completion before starting the project itself, so this
     * one starts only once every other worker has exited and has the machine
     * to itself.
     */
    {
      name: 'perf',
      testDir: './e2e/tests/hub',
      testMatch: '**/realtime/completion-perf.spec.ts',
      dependencies: ['app', 'hub', 'share'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: HUB_VIEWPORT,
        storageState: HUB_STORAGE_STATE,
      },
      fullyParallel: false,
      workers: 1,
    },
  ],
  webServer: [
    {
      command: `pnpm dev --port ${PORT}`,
      env: { ...serverEnv, BETTER_AUTH_URL: baseURL },
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    /**
     * The fake Google (M17). Started before the second app server, which is
     * pointed at it by `GOOGLE_API_BASE_URL`.
     */
    {
      command: `node e2e/support/fake-google.mjs`,
      env: { FAKE_GOOGLE_PORT: String(FAKE_GOOGLE_PORT) },
      port: FAKE_GOOGLE_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    /**
     * A second app server, identical to the first except that Google *is*
     * configured — against the fake.
     *
     * Two servers rather than one because `isGoogleConfigured()` is a property
     * of the process's environment, and both states are worth covering end to
     * end: the default install with linking switched off (which is what
     * `tests/app/google/google-settings.spec.ts` asserts, and what keeps the
     * rest of the suite free of credentials), and a linked household actually
     * pulling events (`sync-smoke.spec.ts`). Trying to serve both from one
     * process would mean making configuration a per-request decision, which is
     * a worse thing to do to production code than starting a second server is
     * to a test run.
     */
    {
      command: `pnpm dev --port ${GOOGLE_PORT}`,
      env: {
        ...serverEnv,
        BETTER_AUTH_URL: googleBaseURL,
        // Its own build directory: Next refuses two dev servers sharing
        // `.next/dev` in one project (see `next.config.ts`).
        NEXT_DIST_DIR: '.next-e2e-google',
        GOOGLE_CLIENT_ID: 'e2e-client-id',
        GOOGLE_CLIENT_SECRET: 'e2e-client-secret',
        GOOGLE_API_BASE_URL: fakeGoogleURL,
      },
      url: googleBaseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
