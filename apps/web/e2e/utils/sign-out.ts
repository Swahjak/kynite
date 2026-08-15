import type { Page } from '@playwright/test';

/**
 * Sign out of the parent app, from whichever nav shape this viewport renders.
 *
 * M21 deleted the shell's glass header, and with it the bare "Uitloggen"
 * button every spec used to click. The sign-out now lives with the signed-in
 * member's avatar at the bottom of the nav — which is two different components
 * (`components/app-nav/user-menu.tsx`):
 *
 * - tablet/desktop (the `hub` project's 1280px viewport): an avatar tile at the
 *   foot of the rail, opening a menu upward;
 * - phone (the `app` project's 390px viewport, where the rail is `hidden`): an
 *   account block at the bottom of the "More" sheet the bottom bar opens.
 *
 * Specs that only care about *being signed out* should not have to know which
 * of the two they are on, so this branches on what is actually visible rather
 * than on the project's configured width.
 */
export async function signOutFromNav(page: Page): Promise<void> {
  const railTrigger = page.getByTestId('user-menu-trigger');

  if (await railTrigger.isVisible()) {
    await railTrigger.click();
  } else {
    await page.getByTestId('mobile-nav-more').click();
  }

  await page.getByTestId('sign-out').click();
}
