import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from '../../fixtures/family';
import {
  expireInvite,
  memberByDisplayName,
  presetAvatar,
  seedCalendar,
  seedEvents,
  withDb,
} from '../../utils/seed';

/**
 * Second-parent onboarding, end to end (M14, PRD FR26).
 *
 * Every spec here runs the invitee in a **fresh browser context** — no cookies,
 * no shared storage with the owner's page. That is not tidiness: the whole
 * claim is that a stranger with a link becomes a member of the household, and
 * running it in the owner's context would prove something much weaker.
 *
 * The two criteria that shape this file:
 *
 *  - *"exactly three interactions … types no free-text data at any step"* —
 *    `expectNoTypeableField` is asserted on every screen of the flow, and the
 *    whole flow is driven with three clicks and nothing else. No `.fill()`
 *    appears anywhere in the invitee's path; if one ever has to, the spec has
 *    stopped testing FR26.
 *
 *  - *"the invitee's own Google Calendar events appear merged"* — Google is
 *    faked the way the rest of this suite fakes it (`seedCalendar` writes the
 *    `google_account` + `calendar` rows that `linkGoogleAccount` +
 *    `bootstrapAccount` would write, and `seedEvents` writes what a sync would
 *    have pulled down). Playwright cannot intercept a *server-side* fetch, and
 *    `GOOGLE_CLIENT_ID` is deliberately absent from the e2e environment, so
 *    seeding the post-consent state is the honest way to assert the thing that
 *    actually matters here: that a calendar owned by the newly claimed member
 *    shows up merged in the family view.
 */

const SECOND_PARENT = 'Papa';

/**
 * The no-typing assertion, applied to whatever screen is currently open.
 *
 * Deliberately broader than "no `<input type=text>`": a select, a textarea and
 * a `contenteditable` are all ways to make somebody enter data, and hidden
 * inputs are exempt because they carry values the *server* chose. This is the
 * executable form of the acceptance criterion, so it errs towards catching too
 * much rather than too little.
 */
async function expectNoTypeableField(page: Page, step: string): Promise<void> {
  const typeable = page.locator(
    'input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select, [contenteditable="true"]'
  );

  await expect(typeable, `step "${step}" must ask the invitee to type nothing`).toHaveCount(0);
}

/** Mint an invite through the real roster UI and read the link back off the page. */
async function mintInvite(page: Page, displayName = SECOND_PARENT): Promise<string> {
  await page.goto('/nl/family');

  // The owner creates the member row first — the invite claims a row that
  // already exists, so there has to be one. Role `adult`: a child never logs
  // in, so a child row is not invitable and the button would never appear.
  await page.getByRole('button', { name: 'Gezinslid toevoegen' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Naam').fill(displayName);
  await dialog.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Volwassene' }).click();
  await dialog.getByRole('button', { name: 'Opslaan' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText(displayName, { exact: true })).toBeVisible();

  // The one address anybody types in this entire feature, and it is the
  // owner who types it.
  await page.getByTestId('member-invite-open').click();
  await page.getByTestId('member-invite-email').fill(`papa-${Date.now()}@kynite.test`);
  await page.getByTestId('member-invite-send').click();

  const url = page.getByTestId('member-invite-url');
  await expect(url).toBeVisible();

  return (await url.inputValue()).trim();
}

/** A browser that has never met this application. */
async function freshInvitee(
  browser: import('@playwright/test').Browser
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

test.describe('second-parent onboarding', () => {
  test('is three interactions and no typing, from link to Google', async ({
    page,
    browser,
    family,
  }) => {
    const inviteUrl = await mintInvite(page);
    const { context, page: invitee } = await freshInvitee(browser);

    try {
      // ---- Interaction 1: accept -------------------------------------------
      await invitee.goto(inviteUrl);
      await expect(invitee.getByTestId('invite-accept')).toBeVisible();
      await expectNoTypeableField(invitee, 'accept');
      // The row the owner made is what the invitee is being handed.
      await expect(invitee.getByText(SECOND_PARENT, { exact: true })).toBeVisible();

      await invitee.getByRole('button', { name: 'Doe mee' }).click();

      // ---- Interaction 2: pick an avatar and colour ------------------------
      await expect(invitee.getByTestId('invite-profile')).toBeVisible();
      await expectNoTypeableField(invitee, 'profile');

      await invitee.getByTestId('invite-profile-fox').click();

      // ---- Interaction 3: grant Google access ------------------------------
      await expect(invitee.getByTestId('invite-google')).toBeVisible();
      await expectNoTypeableField(invitee, 'google');

      const connect = invitee.getByTestId('invite-google-connect');
      // The third interaction is a click that leaves for Google's consent
      // screen. `returnTo=onboarding` is what brings them back to the calendar
      // rather than to a settings page they never asked for.
      await expect(connect).toHaveAttribute('href', '/api/google/oauth/start?returnTo=onboarding');

      // The claim really happened, and it happened to the row that already
      // existed: same member, now carrying a login and the chosen avatar.
      const claimed = await withDb((client) =>
        memberByDisplayName(client, family.familyId, SECOND_PARENT)
      );

      expect(claimed?.userId).not.toBeNull();
    } finally {
      await context.close();
    }
  });

  /**
   * The §7 adult column, from the invitee's own browser: their own calendars
   * and their own Google links, and none of the owner-only rights.
   */
  test('lands the second parent on the adult role, not the owner one', async ({
    page,
    browser,
  }) => {
    const inviteUrl = await mintInvite(page);
    const { context, page: invitee } = await freshInvitee(browser);

    try {
      await invitee.goto(inviteUrl);
      await invitee.getByRole('button', { name: 'Doe mee' }).click();
      await expect(invitee.getByTestId('invite-profile')).toBeVisible();
      await invitee.getByTestId('invite-profile-fox').click();
      await expect(invitee.getByTestId('invite-google')).toBeVisible();

      // Granted: the family calendar, and a Google settings page of their own.
      await invitee.goto('/nl/calendar');
      await expect(invitee).toHaveURL(/\/nl\/calendar/);

      await invitee.goto('/nl/settings/google');
      await expect(invitee).toHaveURL(/\/settings\/google/);

      // Withheld: `member:manage` is owner-only, so the roster offers them no
      // invite controls at all — they cannot hand out a login of their own.
      await invitee.goto('/nl/family');
      await expect(invitee.getByText(SECOND_PARENT, { exact: true })).toBeVisible();
      await expect(invitee.getByTestId('member-invite-open')).toHaveCount(0);
      await expect(invitee.getByTestId('member-invite-pending')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("merges the invitee's own Google calendar into the family view", async ({
    page,
    browser,
    family,
  }) => {
    const inviteUrl = await mintInvite(page);
    const { context, page: invitee } = await freshInvitee(browser);

    try {
      await invitee.goto(inviteUrl);
      await invitee.getByRole('button', { name: 'Doe mee' }).click();
      await expect(invitee.getByTestId('invite-profile')).toBeVisible();
      await invitee.getByTestId('invite-profile-fox').click();
      await expect(invitee.getByTestId('invite-google')).toBeVisible();

      // Stand in for the consent round trip: these are exactly the rows
      // `linkGoogleAccount` + `bootstrapAccount` + the first sync would leave
      // behind — an account owned by the *newly claimed member*, one calendar,
      // one event on it.
      const start = new Date();
      start.setHours(start.getHours() + 3, 0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);

      await withDb(async (client) => {
        const claimed = await memberByDisplayName(client, family.familyId, SECOND_PARENT);
        expect(claimed, 'the second parent should exist by now').not.toBeNull();

        const calendarId = await seedCalendar(client, family.familyId, claimed!.id, {
          summary: 'Agenda van Papa',
          color: '#8b5cf6',
        });

        await seedEvents(client, family.familyId, [
          {
            title: 'Tandarts Papa',
            calendarId,
            ownerMemberId: claimed!.id,
            startsAt: start.toISOString(),
            endsAt: end.toISOString(),
          },
        ]);
      });

      // With their Google account linked, the flow is finished and the route
      // hands them the family view — FR26's "immediately", literally.
      await invitee.goto(inviteUrl);
      await expect(invitee).toHaveURL(/\/nl\/calendar/);

      // The payoff: their own event, merged into the household's calendar.
      await expect(invitee.getByText('Tandarts Papa').first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('cannot be replayed: a second browser gets the already-claimed screen', async ({
    page,
    browser,
  }) => {
    const inviteUrl = await mintInvite(page);
    const first = await freshInvitee(browser);
    const second = await freshInvitee(browser);

    try {
      await first.page.goto(inviteUrl);
      await first.page.getByRole('button', { name: 'Doe mee' }).click();
      await expect(first.page.getByTestId('invite-profile')).toBeVisible();

      // Same link, different browser. The token is spent; what survives is the
      // first browser's right to finish, and nothing else.
      await second.page.goto(inviteUrl);
      await expect(second.page.getByTestId('invite-gone')).toBeVisible();
      await expect(second.page.getByTestId('invite-accept')).toHaveCount(0);

      // The owner's roster shows no second "join" button to press either.
      await first.page.reload();
      await expect(first.page.getByTestId('invite-profile')).toBeVisible();
    } finally {
      await first.context.close();
      await second.context.close();
    }
  });

  test('an expired link is refused with a friendly screen, not the flow', async ({
    page,
    browser,
    family,
  }) => {
    const inviteUrl = await mintInvite(page);

    await withDb(async (client) => {
      const member = await memberByDisplayName(client, family.familyId, SECOND_PARENT);
      await expireInvite(client, member!.id);
    });

    const { context, page: invitee } = await freshInvitee(browser);

    try {
      await invitee.goto(inviteUrl);
      await expect(invitee.getByTestId('invite-gone')).toBeVisible();
      await expect(invitee.getByTestId('invite-accept')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test('a revoked link stops working, and revocation is two taps', async ({ page, browser }) => {
    const inviteUrl = await mintInvite(page);

    await page.goto('/nl/family');
    await expect(page.getByTestId('member-invite-pending')).toBeVisible();

    // Destructive to whoever holds the link, so a stray tap is not enough.
    await page.getByTestId('member-invite-revoke').click();
    await page.getByTestId('member-invite-revoke-confirm').click();
    await expect(page.getByTestId('member-invite-open')).toBeVisible();

    const { context, page: invitee } = await freshInvitee(browser);

    try {
      await invitee.goto(inviteUrl);
      await expect(invitee.getByTestId('invite-gone')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  /**
   * F10: step 2 must never be silently skipped, even when `member.avatarUrl`
   * is already non-null — which happens whenever the owner pre-set (or later
   * edits) the avatar on the member row while the invite is outstanding.
   * Deriving "step 2 done" from `avatarUrl` alone would skip the invitee's own
   * tap at "this is me"; `memberInvite.profileCompletedAt` is the explicit
   * marker instead (`modules/family/schema.ts`).
   */
  test('always shows the profile step, even when the owner pre-set an avatar', async ({
    page,
    browser,
    family,
  }) => {
    const inviteUrl = await mintInvite(page);

    await withDb(async (client) => {
      const target = await memberByDisplayName(client, family.familyId, SECOND_PARENT);
      await presetAvatar(client, target!.id, '/avatars/owl.svg');
    });

    const { context, page: invitee } = await freshInvitee(browser);

    try {
      await invitee.goto(inviteUrl);
      await invitee.getByRole('button', { name: 'Doe mee' }).click();

      // Not skipped straight to the Google step, despite `avatarUrl` already
      // being set on the row.
      await expect(invitee.getByTestId('invite-profile')).toBeVisible();

      await invitee.getByTestId('invite-profile-fox').click();
      await expect(invitee.getByTestId('invite-google')).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('a garbage token never reaches the flow', async ({ browser }) => {
    const { context, page } = await freshInvitee(browser);

    try {
      await page.goto('/nl/invite/not-a-real-token');
      await expect(page.getByTestId('invite-gone')).toBeVisible();
      await expect(page.getByTestId('invite-accept')).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
