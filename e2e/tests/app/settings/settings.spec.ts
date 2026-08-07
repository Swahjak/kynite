import { newAnonymousContext } from '@e2e/utils/context';
import { expect, test } from '@e2e/fixtures/family';
import { pairHub } from '@e2e/fixtures/hub';
import {
  ownerMemberOf,
  seedCalendar,
  seedEvents,
  seedMembers,
  seedRewards,
  seedRoutines,
  withDb,
  type SeededMember,
  type SeededRoutine,
} from '@e2e/utils/seed';

/**
 * The settings hub, end to end (M16).
 *
 * Four of M16's criteria can only be proved in a browser, and each one is a
 * *pair* of surfaces disagreeing or agreeing:
 *
 *  - a child's reward horizon changed in the Controller, and the hub's reward
 *    UI switching between instant and savings because of it;
 *  - a graduation toggle flipping one routine and leaving its sibling alone;
 *  - a hub display preference set on the phone taking effect on an
 *    already-paired wall display, with nothing re-paired and nothing tapped on
 *    the tablet;
 *  - the household's language and timezone changing, and every surface
 *    re-rendering without anyone signing back in.
 *
 * The wall display is always a *second browser context*: a browser holding a
 * device cookie is a kiosk regardless of what account session it also carries
 * (`modules/family/principal.ts`), so one context cannot be both.
 *
 * Owner-vs-adult refusals are not here — they belong to
 * `tests/integration/settings-authorization.test.ts`, which can assert the
 * absence of the row a refused action would have written. A browser can only
 * see that a button is missing.
 */

type Fixture = {
  familyId: string;
  child: SeededMember;
  sibling: SeededMember;
  routines: SeededRoutine[];
  owner: SeededMember;
  calendarId: string;
};

async function seedHousehold(familyId: string): Promise<Fixture> {
  return withDb(async (client) => {
    const owner = await ownerMemberOf(client, familyId);
    const [child, sibling] = await seedMembers(client, familyId, [
      { displayName: 'Bram', role: 'child', color: 'orange', sortOrder: 1 },
      { displayName: 'Fenna', role: 'child', color: 'teal', sortOrder: 2 },
    ]);

    const routines = await seedRoutines(client, familyId, [
      {
        title: 'Tanden poetsen',
        ownerMemberId: child.id,
        schedule: { rrule: 'FREQ=DAILY', timeOfDay: '07:30' },
        steps: [{ title: 'Borstel pakken' }],
      },
      {
        title: 'Jas ophangen',
        ownerMemberId: sibling.id,
        schedule: { rrule: 'FREQ=DAILY', timeOfDay: '08:00' },
        steps: [{ title: 'Haakje' }],
      },
    ]);

    // A shelf with something on it: the savings tier's goal card is the
    // *nearest reward still out of reach*, so a family with an empty catalogue
    // has nothing to save towards and renders no card either way — which would
    // make the horizon assertion below vacuous.
    await seedRewards(client, familyId, [
      { title: 'Extra voorleesverhaal', costStars: 12, category: 'experience' },
    ]);

    const calendarId = await seedCalendar(client, familyId, owner.id, {
      summary: 'Werk',
      color: '#ef4444',
      visibility: 'family',
    });

    return { familyId, child, sibling, routines, owner, calendarId };
  });
}

test.describe('settings hub', () => {
  test('has a section for every part of the household', async ({ page, family }) => {
    await seedHousehold(family.familyId);

    await page.goto('/nl/settings');

    for (const section of [
      'family',
      'members',
      'graduation',
      'notifications',
      'calendars',
      'devices',
      'sharing',
    ]) {
      await expect(page.getByTestId(`settings-section-${section}`)).toBeVisible();
    }

    // The four surfaces that keep their own route are reachable from here.
    await expect(page.getByRole('link', { name: 'Apparaten beheren' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Deellinks beheren' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Google-accounts beheren' })).toBeVisible();
  });
});

test.describe('reward horizon', () => {
  test("switches that child's hub store between instant and savings", async ({
    page,
    family,
    browser,
  }) => {
    const { child } = await seedHousehold(family.familyId);

    const kiosk = await newAnonymousContext(browser, { locale: 'nl-NL' });
    const hub = await kiosk.newPage();
    // Land on a `(hub)` route first: it redirects to the pair screen, which is
    // where the service worker registers. `pairHub` waits for that worker to be
    // active, and on the marketing page it never would be.
    await hub.goto('/nl/hub');
    await pairHub(hub, family.familyId);

    // Instant is the column default: the store carries the horizon it renders
    // and there is no savings goal on it.
    await hub.goto(`/nl/hub/store?member=${child.id}`);
    await expect(hub.getByTestId('reward-store')).toHaveAttribute('data-horizon', 'instant');
    await expect(hub.getByTestId('savings-goal')).toHaveCount(0);

    // --- The parent's phone, in the settings hub's members section ----------
    await page.goto('/nl/settings');
    const row = page.getByTestId('member-row').filter({ hasText: 'Bram' });
    await row.getByRole('button', { name: 'Bewerken' }).click();

    await page.getByTestId('member-reward-horizon').click();
    await page.getByRole('option', { name: 'Sparen voor beloning' }).click();
    await page.getByTestId('save-member').click();
    // The dialog closes itself once the action returns without an error, so
    // its disappearance is the signal that the write landed — a wait on a
    // condition, never on a duration.
    await expect(page.getByTestId('save-member')).toHaveCount(0);

    // --- Back at the wall ---------------------------------------------------
    await hub.reload();
    await expect(hub.getByTestId('reward-store')).toHaveAttribute('data-horizon', 'savings');
    // The savings tier is the only one with a goal card: for a four-year-old a
    // progress bar towards something days away is a bar that does not move.
    await expect(hub.getByTestId('savings-goal')).toBeVisible();

    await kiosk.close();
  });
});

test.describe('graduation', () => {
  test('lists every routine together and fades exactly one of them', async ({ page, family }) => {
    const { routines } = await seedHousehold(family.familyId);
    const [teeth, coat] = routines;

    await page.goto('/nl/settings');

    const teethRow = page.getByTestId('graduation-row').filter({ hasText: 'Tanden poetsen' });
    const coatRow = page.getByTestId('graduation-row').filter({ hasText: 'Jas ophangen' });

    await expect(teethRow).toHaveAttribute('data-graduated', 'false');
    await expect(coatRow).toHaveAttribute('data-graduated', 'false');

    await teethRow.getByTestId('graduate-routine').click();

    await expect(teethRow).toHaveAttribute('data-graduated', 'true');
    await expect(coatRow, 'the sibling routine is untouched').toHaveAttribute(
      'data-graduated',
      'false'
    );

    // The database agrees, for the one routine and only that one.
    const rows = await withDb(async (client) => {
      const { rows } = await client.query<{
        id: string;
        reward_enabled: boolean;
        faded_at: Date | null;
      }>(`select id, reward_enabled, faded_at from routine where family_id = $1`, [
        family.familyId,
      ]);
      return rows;
    });

    const teethRowDb = rows.find((row) => row.id === teeth.id)!;
    const coatRowDb = rows.find((row) => row.id === coat.id)!;
    expect(teethRowDb.reward_enabled).toBe(false);
    expect(teethRowDb.faded_at).not.toBeNull();
    expect(coatRowDb.reward_enabled).toBe(true);
    expect(coatRowDb.faded_at).toBeNull();

    // And back again — a parent who fades too early undoes it in one tap.
    await teethRow.getByTestId('ungraduate-routine').click();
    await expect(teethRow).toHaveAttribute('data-graduated', 'false');
  });
});

test.describe('hub display preferences', () => {
  test('take effect on an already-paired wall display, with no re-pairing', async ({
    page,
    family,
    browser,
  }) => {
    await seedHousehold(family.familyId);

    const kiosk = await newAnonymousContext(browser, { locale: 'nl-NL' });
    const hub = await kiosk.newPage();
    await hub.goto('/nl/hub');
    const device = await pairHub(hub, family.familyId);

    await hub.goto('/nl/hub');
    await expect(hub.getByTestId('hub-board')).toBeVisible();
    // The default board: one column per person.
    await expect(hub.locator('[data-slot="person-columns"]')).toBeVisible();

    // --- The parent's phone -------------------------------------------------
    await page.goto('/nl/settings');
    await page.getByTestId('hub-default-view').click();
    await page.getByRole('option', { name: 'Lijst van wat eraan komt' }).click();
    await page.getByTestId('save-hub-display').click();
    await expect(page.getByTestId('save-hub-display')).toBeEnabled();

    // --- The wall, without re-pairing ---------------------------------------
    // A reload, not a re-pair: the same device session, the same cookie. (The
    // live path is `SettingsWatcher` on the SSE stream; what the criterion
    // demands is that no *credential* changes, which is what is asserted
    // here — the device row is the one that was paired before the change.)
    await hub.reload();
    await expect(hub.locator('[data-slot="agenda-view"]')).toBeVisible();
    await expect(hub.getByTestId('hub-device-name')).toContainText(device.deviceName);

    await kiosk.close();
  });

  test('carry a per-calendar colour and a private calendar onto the board', async ({
    page,
    family,
  }) => {
    const { owner, calendarId } = await seedHousehold(family.familyId);

    // BLOCKING B-2: the settings write is asserted against the database above,
    // but nothing proved the colour actually *reaches a board* — the middle
    // rung of `resolveCategory` (`calendarCategory`, `domain/category.ts`).
    // An event with no per-event override on this calendar, so its chip's
    // colour can only have come from the calendar-level rung this test sets.
    const now = new Date();
    await withDb((client) =>
      seedEvents(client, family.familyId, [
        {
          title: 'Werkoverleg',
          startsAt: now.toISOString(),
          endsAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
          ownerMemberId: owner.id,
          calendarId,
        },
      ])
    );

    await page.goto('/nl/settings');

    const row = page.getByTestId('calendar-display-row').filter({ hasText: 'Werk' });
    await expect(row).toBeVisible();

    await row.getByTestId('calendar-color-purple').click();
    await row.getByTestId('calendar-visibility').click();
    await page.getByRole('option', { name: 'Privé — alleen bezet' }).click();
    await row.getByTestId('save-calendar-display').click();
    await expect(row.getByTestId('save-calendar-display')).toBeEnabled();

    // Persisted, both halves of the one transaction.
    await page.reload();
    const saved = page.getByTestId('calendar-display-row').filter({ hasText: 'Werk' });
    await expect(saved.getByTestId('calendar-color-purple')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(saved.getByTestId('calendar-visibility')).toContainText('Privé');

    const stored = await withDb(async (client) => {
      const { rows } = await client.query<{ category: string; visibility: string }>(
        `select d.category, c.visibility
           from calendar c join calendar_display d on d.calendar_id = c.id
          where c.family_id = $1`,
        [family.familyId]
      );
      return rows[0];
    });

    expect(stored).toMatchObject({ category: 'purple', visibility: 'private' });

    // The colour reaching a board, not just the row: `resolveCategory`'s
    // middle rung (`calendarCategory`) is what paints this chip purple — the
    // event itself carries no per-event `category` override.
    await page.goto('/nl/today');
    await expect(page.locator('[data-slot="event-chip"][data-category="purple"]')).toBeVisible();
  });
});

test.describe('household language and clock', () => {
  test('re-render every surface without a re-login', async ({ page, family, browser }) => {
    const { child } = await seedHousehold(family.familyId);

    const kiosk = await newAnonymousContext(browser, { locale: 'nl-NL' });
    const hub = await kiosk.newPage();
    // Land on a `(hub)` route first: it redirects to the pair screen, which is
    // where the service worker registers. `pairHub` waits for that worker to be
    // active, and on the marketing page it never would be.
    await hub.goto('/nl/hub');
    await pairHub(hub, family.familyId);
    await hub.goto('/nl/hub');
    await expect(hub.locator('html')).toHaveAttribute('lang', 'nl');

    // --- The parent's phone -------------------------------------------------
    await page.goto('/nl/settings');
    await page.getByTestId('family-timezone').fill('Pacific/Auckland');
    await page.getByTestId('family-locale').click();
    await page.getByRole('option', { name: 'Engels' }).click();
    await page.getByTestId('save-family-settings').click();
    await expect(page.getByTestId('save-family-settings')).toBeEnabled();

    // The parent stays signed in and stays on their own locale: `/nl` is a
    // per-person surface, and two parents may read the app in two languages.
    await expect(page).toHaveURL(/\/nl\/settings/);
    await expect(page.getByTestId('family-timezone')).toHaveValue('Pacific/Auckland');
    // No sign-in bounce anywhere: the session is untouched by a settings write.
    await page.goto('/nl/today');
    await expect(page).toHaveURL(/\/nl\/today$/);

    // --- The wall display follows the household -----------------------------
    // `family.locale` is the household's language, and a kiosk has no person
    // behind it to hold one of its own, so the hub moves to `/en/hub` on its
    // next request — without re-pairing.
    await hub.goto('/nl/hub');
    await expect(hub).toHaveURL(/\/en\/hub$/);
    await expect(hub.locator('html')).toHaveAttribute('lang', 'en');

    // The star chart for the same child renders under the new locale too.
    await hub.goto(`/nl/hub/stars/${child.id}`);
    await expect(hub).toHaveURL(new RegExp(`/en/hub/stars/${child.id}$`));

    await kiosk.close();
  });
});
