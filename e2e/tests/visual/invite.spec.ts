import { test as base, expect } from '@playwright/test';
import { signUpFamily } from '../../fixtures/family';
import { settlePage } from '../../utils/settle';

/**
 * Visual regression for the second-parent flow (M14).
 *
 * This is the one spec in the suite that deliberately does **not** use the
 * `family` fixture. That fixture names each household `Familie <timestamp>` so
 * parallel runs cannot collide — excellent for every other spec, fatal here,
 * because the accept screen renders the family name in its heading and the
 * snapshot would differ on every run. Signing up by hand with a fixed name buys
 * determinism without a mask, which is the rule the rest of the visual specs
 * follow (see `visual/calendar.spec.ts`).
 *
 * Phone-sized, and only phone-sized: an invite arrives as a link in a message,
 * so the second parent opens it on their phone. There is no hub or desktop
 * version of this flow worth pinning.
 *
 * Update deliberately with `pnpm e2e:visual:update`.
 */

const test = base.extend({});

test.use({ viewport: { width: 390, height: 844 } });

const SECOND_PARENT = 'Papa';

test.describe('second-parent onboarding', () => {
  test('renders all three steps', async ({ page, browser }) => {
    const family = await signUpFamily(page, 'Familie Kynite');

    // Owner side: the member row the invite hands over, then the link.
    await page.goto('/nl/family');
    await page.getByRole('button', { name: 'Gezinslid toevoegen' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Naam').fill(SECOND_PARENT);
    await dialog.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Volwassene' }).click();
    await dialog.getByRole('button', { name: 'Opslaan' }).click();
    await expect(dialog).toBeHidden();

    await page.getByTestId('member-invite-open').click();
    await page.getByTestId('member-invite-email').fill(`papa-${family.familyId}@kynite.test`);
    await page.getByTestId('member-invite-send').click();

    const inviteUrl = (await page.getByTestId('member-invite-url').inputValue()).trim();

    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const invitee = await context.newPage();

    try {
      await invitee.goto(inviteUrl);
      await expect(invitee.getByTestId('invite-accept')).toBeVisible();
      await settlePage(invitee);
      await expect(invitee).toHaveScreenshot('invite-accept-mobile.png', { fullPage: true });

      await invitee.getByRole('button', { name: 'Doe mee' }).click();
      await expect(invitee.getByTestId('invite-profile')).toBeVisible();
      await settlePage(invitee);
      await expect(invitee).toHaveScreenshot('invite-profile-mobile.png', { fullPage: true });

      await invitee.getByTestId('invite-profile-fox').click();
      await expect(invitee.getByTestId('invite-google')).toBeVisible();
      await settlePage(invitee);
      await expect(invitee).toHaveScreenshot('invite-google-mobile.png', { fullPage: true });
    } finally {
      await context.close();
    }
  });

  test('renders the already-claimed screen', async ({ page }) => {
    await page.goto('/nl/invite/not-a-real-token');
    await expect(page.getByTestId('invite-gone')).toBeVisible();
    await settlePage(page);
    await expect(page).toHaveScreenshot('invite-gone-mobile.png', { fullPage: true });
  });
});
