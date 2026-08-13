import { getCookieCache } from 'better-auth/cookies';
import { expect, test } from '@playwright/test';

/**
 * Every test in this file starts from a browser that has never been anything.
 *
 * The `app` project hands each context the baseline parent's session (M17), so
 * that the surfaces a signed-in parent uses need no setup. This file is about
 * the other half — the sign-up form, the sign-in guard, the locale a *new*
 * visitor lands on — and all of it is a different assertion once a session is
 * already present.
 */
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

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
  test(
    'signs a returning parent back into their own family',
    { tag: '@smoke' },
    async ({ page }) => {
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
    }
  );

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

test.describe('signed-in redirect', () => {
  // F8: `sign-in/page.tsx` and `sign-up/page.tsx` each bounce a caller who
  // already has a scoped session — that rule lives on the two forms
  // themselves rather than on `(auth)/layout.tsx` (see that file's comment:
  // `invite/[token]` continues past its own accept step with a freshly issued
  // session, so a layout-level guard would eject the second parent from the
  // middle of the flow it just signed them into). This is the coverage for
  // the two forms where the rule *does* apply — previously asserted nowhere.
  test('a signed-in user visiting /sign-in is sent to /family, not the form', async ({ page }) => {
    await signUp(page, `Familie Redirect ${Date.now()}`);
    await expect(page).toHaveURL(/\/nl\/family$/);

    await page.goto('/nl/sign-in');

    await expect(page).toHaveURL(/\/nl\/family$/);
  });

  test('a signed-in user visiting /sign-up is sent to /family, not the form', async ({ page }) => {
    await signUp(page, `Familie Redirect2 ${Date.now()}`);
    await expect(page).toHaveURL(/\/nl\/family$/);

    await page.goto('/nl/sign-up');

    await expect(page).toHaveURL(/\/nl\/family$/);
  });
});

test.describe('app guard', () => {
  test('sends an unauthenticated visitor to sign-in, remembering where they were going', async ({
    page,
  }) => {
    await page.goto('/nl/family');

    // M18: the destination survives the bounce. Before this the proxy cleared
    // the query string outright (`url.search = ''`), so a parent who tapped a
    // link to a settings page from an email signed in and landed somewhere
    // else entirely.
    await expect(page).toHaveURL(/\/nl\/sign-in\?callbackUrl=%2Fnl%2Ffamily$/);
    await expect(page.getByRole('heading', { name: 'Inloggen' })).toBeVisible();
    await expect(page.getByTestId('callback-url')).toHaveValue('/nl/family');
  });

  test('keeps every (app) section closed', async ({ page }) => {
    await page.goto('/nl/today');

    await expect(page).toHaveURL(/\/nl\/sign-in\?callbackUrl=%2Fnl%2Ftoday$/);
  });

  test('returns the parent to the page they asked for after signing in', async ({ page }) => {
    const email = await signUp(page, `Familie Callback ${Date.now()}`);
    await expect(page).toHaveURL(/\/nl\/family$/);

    // Sign out by hand rather than through the button: this test is about the
    // *guard*, and the fastest honest way to be anonymous again is to be
    // anonymous again.
    await page.context().clearCookies();

    await page.goto('/nl/settings/devices');
    await expect(page).toHaveURL(/callbackUrl=%2Fnl%2Fsettings%2Fdevices$/);

    await page.getByLabel('E-mailadres').fill(email);
    await page.getByLabel('Wachtwoord').fill(PASSWORD);
    await page.getByRole('button', { name: 'Inloggen' }).click();

    await expect(page).toHaveURL(/\/nl\/settings\/devices$/);
  });

  test('refuses a callbackUrl pointing at another origin', async ({ page }) => {
    const email = await signUp(page, `Familie OpenRedirect ${Date.now()}`);
    await page.context().clearCookies();

    // The parameter is attacker-controllable — anybody can send a household a
    // link with any value on it — so an absolute URL must be dropped rather
    // than followed.
    await page.goto('/nl/sign-in?callbackUrl=https%3A%2F%2Fevil.example%2Ftake-over');
    await expect(page.getByTestId('callback-url')).toHaveCount(0);

    await page.getByLabel('E-mailadres').fill(email);
    await page.getByLabel('Wachtwoord').fill(PASSWORD);
    await page.getByRole('button', { name: 'Inloggen' }).click();

    await expect(page).toHaveURL(/\/nl\/family$/);
  });
});
