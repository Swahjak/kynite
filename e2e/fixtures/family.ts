import { getCookieCache } from 'better-auth/cookies';
import { test as base, type Page } from '@playwright/test';

/**
 * A signed-up family with a real session, as a Playwright fixture.
 *
 * Sign-up goes through the UI rather than the database: the session cookie has
 * to be the one better-auth actually issues, carrying `activeFamilyId` and
 * `memberId` (M03), because every calendar read resolves its principal from it.
 * Seeding a family row directly would produce a family no request can reach.
 */

export type FamilyContext = {
  familyId: string;
  memberId: string;
  email: string;
};

const PASSWORD = 'correct-horse-battery';

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

export async function signUpFamily(page: Page, familyName: string): Promise<FamilyContext> {
  const email = uniqueEmail();

  // M17: every project now starts its contexts from a storage state — a
  // signed-in parent on `app`, a paired tablet on `hub`. Both of those would
  // change what `/nl/sign-up` does (the signed-in guard redirects to /family;
  // a device cookie outranks the account session on every route), so a spec
  // that wants its *own* family has to stop being whoever the project made it
  // first. Clearing here rather than in each spec is what makes the baseline
  // session a starting point instead of shared state.
  await page.context().clearCookies();

  await page.goto('/nl/sign-up');
  await page.getByLabel('Jouw naam').fill('Sanne');
  await page.getByLabel('Naam van je gezin').fill(familyName);
  await page.getByLabel('E-mailadres').fill(email);
  await page.getByLabel('Wachtwoord').fill(PASSWORD);
  await page.getByRole('button', { name: 'Gezin aanmaken' }).click();

  await page.waitForURL(/\/nl\/family$/);

  const cookies = await page.context().cookies();
  const header = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  const cached = await getCookieCache(new Headers({ cookie: header }), {
    secret: process.env.BETTER_AUTH_SECRET,
  });

  return {
    familyId: cached!.session.activeFamilyId as string,
    memberId: cached!.session.memberId as string,
    email,
  };
}

export const test = base.extend<{ family: FamilyContext }>({
  // `auto`, so every spec in this tree starts signed in whether or not it
  // destructures `family`. Without it, a test that only takes `page` silently
  // runs anonymously and gets redirected to sign-in — which fails as a
  // confusing timeout on some unrelated locator rather than as "no session".
  family: [
    async ({ page }, use) => {
      // Unique per test *attempt*, not per millisecond: `--repeat-each=2` runs
      // two copies of the same test concurrently, and a shared family name is
      // exactly the kind of accidental coupling that mode exists to surface.
      const context = await signUpFamily(
        page,
        `Familie ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      );
      await use(context);
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
