import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { test as setup } from '@playwright/test';

import { signUpFamily } from '@e2e/fixtures/family';
import { pairHub } from '@e2e/fixtures/hub';
import { APP_STORAGE_STATE, HUB_STORAGE_STATE, SHARE_STORAGE_STATE } from '@e2e/support/paths';

/**
 * The three surfaces' storage states (M17).
 *
 * Each Playwright project starts every context as the principal its surface
 * runs behind: `app` as a signed-in parent, `hub` as a paired wall tablet,
 * `share` as a browser that has never been anything. That is the point of the
 * per-surface split — a spec should not have to establish who it is before it
 * can assert anything, and a spec that lands on the wrong surface should fail
 * as "this is the parent app" rather than as a timeout on some locator.
 *
 * What this deliberately is **not** is shared *data*. The baseline family here
 * exists so a surface has a principal; every spec that owns rows still seeds
 * its own family through the factory (`fixtures/family.ts` clears the context
 * first, precisely so the baseline session cannot leak into it). That is what
 * keeps `--repeat-each=2` and a shuffled order honest: two runs of the same
 * spec share this file and nothing else.
 */

function ensureDir(file: string) {
  mkdirSync(dirname(file), { recursive: true });
}

setup('app storage state — a signed-in parent', async ({ page }) => {
  ensureDir(APP_STORAGE_STATE);
  await signUpFamily(page, `Baseline app ${Date.now()}`);
  await page.context().storageState({ path: APP_STORAGE_STATE });
});

setup('hub storage state — a paired wall tablet', async ({ page }) => {
  ensureDir(HUB_STORAGE_STATE);
  const family = await signUpFamily(page, `Baseline hub ${Date.now()}`);
  await pairHub(page, family.familyId, 'Baseline hub');

  // The account session goes with it. A hub is a *device* principal and
  // nothing else (architecture §2), and `getPrincipal()` resolving a device
  // cookie ahead of an account one would hide a surface that only works
  // because a parent happened to be signed in on the same tablet.
  const state = await page.context().storageState();
  const deviceOnly = {
    ...state,
    cookies: state.cookies.filter((cookie) => cookie.name === 'kynite_device_session'),
  };
  const { writeFileSync } = await import('node:fs');
  writeFileSync(HUB_STORAGE_STATE, JSON.stringify(deviceOnly, null, 2));
});

setup('share storage state — nobody at all', async ({ page }) => {
  ensureDir(SHARE_STORAGE_STATE);
  // Written rather than assumed: an *explicit* empty state means a share spec
  // that somehow sees a session is a failure of this file, not of a stale
  // profile directory somebody forgot to clear.
  await page.context().clearCookies();
  await page.context().storageState({ path: SHARE_STORAGE_STATE });
});
