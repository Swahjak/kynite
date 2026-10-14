import { expect, type Page } from '@playwright/test';

/**
 * Waits for the /today timeline to settle, opens the disclosure only if there
 * is one, and returns once a row is really in the DOM.
 *
 * Live and finished rows fold behind `today-past-toggle`, except on a themed
 * day, where the banner replaces the NU strip and live rows stay open. A spec
 * cannot choose the date, so it must not assume either shape; callers keep
 * their own assertion on what the row says.
 */
export async function openFoldedRows(page: Page): Promise<void> {
  const toggle = page.getByTestId('today-past-toggle');
  const rows = page.getByTestId('today-timeline-row');

  await rows.or(toggle).first().waitFor();
  if ((await toggle.count()) > 0) await toggle.first().click();

  await expect(rows.first()).toBeVisible();
}
