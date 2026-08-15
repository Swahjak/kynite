import type { Browser, BrowserContext, BrowserContextOptions } from '@playwright/test';

/**
 * A browser context that is *nobody* (M17).
 *
 * `browser.newContext()` inside a test does not give a blank browser: Playwright
 * applies the project's `use` options to it, storage state included. That is
 * usually what you want, and it is exactly wrong for the several specs whose
 * whole point is a second device that has never been here — the unpaired wall
 * tablet in the pairing flow, the anonymous caller `/api/sse` must refuse, the
 * grandparent opening a share link. Since M17 gave each project a storage state,
 * those contexts silently inherited a session and the assertions started
 * passing or failing for the wrong reason.
 *
 * Passing an explicitly empty storage state is what restores "fresh browser".
 * Everything else about the project (base URL, locale, viewport) is kept,
 * because a second device is still a device on the same host.
 */
export function newAnonymousContext(
  browser: Browser,
  options: BrowserContextOptions = {}
): Promise<BrowserContext> {
  return browser.newContext({ ...options, storageState: { cookies: [], origins: [] } });
}
