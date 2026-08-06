import { getCookieCache } from 'better-auth/cookies';
import { expect, test } from '@playwright/test';

/**
 * M03 acceptance: sign-up creates the family + owner member and lands the user
 * in the app with a scoped session; children are addable without a login; the
 * `(app)` tree is closed to anonymous visitors.
 */

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

const PASSWORD = 'correct-horse-battery';

async function signUp(page: import('@playwright/test').Page, familyName: string): Promise<string> {
  const email = uniqueEmail();

  await page.goto('/nl/sign-up');

  await page.getByLabel('Jouw naam').fill('Sarah');
  await page.getByLabel('Naam van je gezin').fill(familyName);
  await page.getByLabel('E-mailadres').fill(email);
  await page.getByLabel('Wachtwoord').fill(PASSWORD);

  await page.getByRole('button', { name: 'Gezin aanmaken' }).click();

  return email;
}

test.describe('sign-up', () => {
  test('creates the family and the owner member, then lands on /family', async ({ page }) => {
    const familyName = `Familie E2E ${Date.now()}`;

    await signUp(page, familyName);

    await expect(page).toHaveURL(/\/nl\/family$/);
    await expect(page.getByRole('heading', { name: familyName })).toBeVisible();

    // The owner member exists, with the owner badge.
    await expect(page.getByText('Sarah', { exact: true })).toBeVisible();
    await expect(page.getByText('Beheerder')).toBeVisible();

    // M03 contract: the session *cookie* carries the family scope, so
    // authorization is a cookie read rather than a join.
    const cookies = await page.context().cookies();
    const header = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
    const cached = await getCookieCache(new Headers({ cookie: header }), {
      secret: process.env.BETTER_AUTH_SECRET,
    });

    expect(cached?.session.activeFamilyId as string | undefined).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(cached?.session.memberId as string | undefined).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  test('adds a child without a login', async ({ page }) => {
    await signUp(page, `Familie Kind ${Date.now()}`);
    await expect(page).toHaveURL(/\/nl\/family$/);

    await page.getByRole('button', { name: 'Gezinslid toevoegen' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Naam').fill('Bram');
    await dialog.getByRole('button', { name: 'Oranje' }).click();
    await dialog.getByRole('button', { name: 'Vos' }).click();
    await dialog.getByRole('button', { name: 'Opslaan' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText('Bram', { exact: true })).toBeVisible();
    await expect(page.getByText('Geen login')).toBeVisible();
  });
});

test.describe('sign-in', () => {
  test('signs a returning parent back into their own family', async ({ page }) => {
    const familyName = `Familie Terug ${Date.now()}`;
    const email = await signUp(page, familyName);
    await expect(page).toHaveURL(/\/nl\/family$/);

    await page.getByRole('button', { name: 'Uitloggen' }).click();
    await expect(page).toHaveURL(/\/nl\/sign-in$/);

    await page.getByLabel('E-mailadres').fill(email);
    await page.getByLabel('Wachtwoord').fill(PASSWORD);
    await page.getByRole('button', { name: 'Inloggen' }).click();

    await expect(page).toHaveURL(/\/nl\/family$/);
    await expect(page.getByRole('heading', { name: familyName })).toBeVisible();
  });

  test('refuses a wrong password', async ({ page }) => {
    await page.goto('/nl/sign-in');

    await page.getByLabel('E-mailadres').fill('nobody@example.test');
    await page.getByLabel('Wachtwoord').fill('not-the-password');
    await page.getByRole('button', { name: 'Inloggen' }).click();

    // (`getByRole('alert')` would also match Next's route announcer.)
    await expect(page.getByText('Dit e-mailadres of wachtwoord klopt niet.')).toBeVisible();
    await expect(page).toHaveURL(/\/nl\/sign-in$/);
  });
});

test.describe('app guard', () => {
  test('sends an unauthenticated visitor to sign-in', async ({ page }) => {
    await page.goto('/nl/family');

    await expect(page).toHaveURL(/\/nl\/sign-in$/);
    await expect(page.getByRole('heading', { name: 'Inloggen' })).toBeVisible();
  });

  test('keeps every (app) section closed', async ({ page }) => {
    await page.goto('/nl/today');

    await expect(page).toHaveURL(/\/nl\/sign-in$/);
  });
});
