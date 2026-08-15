import { newAnonymousContext } from '@e2e/utils/context';
import { expect, test } from '@e2e/fixtures/family';
import {
  ownerMemberOf,
  seedCalendar,
  seedEvents,
  seedMembers,
  seedRoutines,
  withDb,
} from '@e2e/utils/seed';

/**
 * Caregiver share links, end to end (M13).
 *
 * The whole point of this surface is that it works for somebody who has no
 * account, so the specs that matter run in a **fresh browser context** — a
 * second context with no cookies at all, not a logged-out page in the same one.
 * Playwright gives that for free, and it is the only way to prove "no account
 * and no session cookie set" rather than "no account that we noticed".
 */

const TODAY = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());

/** Mint a link through the real settings UI and read the URL back off the page. */
async function mintLink(
  page: import('@playwright/test').Page,
  options: { role: 'viewer' | 'contributor'; label: string; memberId?: string }
): Promise<string> {
  await page.goto('/nl/settings/sharing');

  await page.getByTestId('share-label-input').fill(options.label);
  await page.getByTestId(`share-role-${options.role}`).check();
  if (options.memberId) await page.getByTestId(`share-member-${options.memberId}`).check();

  await page.getByRole('button', { name: 'Link maken' }).click();

  const url = page.getByTestId('share-url');
  await expect(url).toBeVisible();

  return (await url.innerText()).trim();
}

test.describe('caregiver share links', () => {
  test('a viewer link renders the schedule with no account and no session cookie', async ({
    page,
    browser,
    family,
  }) => {
    const { child, eventTitle } = await withDb(async (client) => {
      const owner = await ownerMemberOf(client, family.familyId);
      const [seededChild] = await seedMembers(client, family.familyId, [
        { displayName: 'Bram', role: 'child', color: 'orange', sortOrder: 1 },
      ]);

      const start = new Date();
      start.setHours(start.getHours() + 2, 0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);

      await seedEvents(client, family.familyId, [
        {
          title: 'Zwemles',
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          ownerMemberId: seededChild.id,
        },
      ]);

      void owner;
      return { child: seededChild, eventTitle: 'Zwemles' };
    });

    const url = await mintLink(page, { role: 'viewer', label: 'Oma', memberId: child.id });

    // A brand-new context: no storage state, no cookies, nothing carried over.
    const caregiver = await newAnonymousContext(browser);
    const caregiverPage = await caregiver.newPage();
    const response = await caregiverPage.goto(url);

    await expect(caregiverPage.getByText(eventTitle)).toBeVisible();

    // The criterion, literally: nothing was set on this context by the visit.
    expect(await caregiver.cookies()).toEqual([]);
    expect(response?.headers()['set-cookie']).toBeUndefined();

    // And the headers that keep the token out of an index and out of a Referer.
    expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
    expect(response?.headers()['referrer-policy']).toBe('no-referrer');

    await caregiver.close();
  });

  test('a viewer link offers nothing to press; a contributor link ticks a step', async ({
    page,
    browser,
    family,
  }) => {
    const child = await withDb(async (client) => {
      const [seeded] = await seedMembers(client, family.familyId, [
        { displayName: 'Bram', role: 'child', color: 'orange', sortOrder: 1 },
      ]);

      await seedRoutines(client, family.familyId, [
        {
          ownerMemberId: seeded.id,
          title: 'Avondroutine',
          schedule: {
            rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU',
            timeOfDay: '00:00',
            graceDays: 1,
          },
          steps: [{ title: 'Tanden poetsen' }],
        },
      ]);

      return seeded;
    });

    const viewerUrl = await mintLink(page, { role: 'viewer', label: 'Oma', memberId: child.id });
    const contributorUrl = await mintLink(page, {
      role: 'contributor',
      label: 'Oppas',
      memberId: child.id,
    });

    const viewerContext = await newAnonymousContext(browser);
    const viewerPage = await viewerContext.newPage();
    await viewerPage.goto(viewerUrl);

    // The step is shown, and it is not a button. A `viewer` link is not a
    // disabled contributor link — there is nothing to press at all.
    await expect(viewerPage.getByTestId('share-step-readonly')).toBeVisible();
    await expect(viewerPage.getByTestId('share-step')).toHaveCount(0);
    await viewerContext.close();

    const sitterContext = await newAnonymousContext(browser);
    const sitterPage = await sitterContext.newPage();
    await sitterPage.goto(contributorUrl);

    const step = sitterPage.getByTestId('share-step');
    await expect(step).toBeVisible();
    await expect(step).toHaveAttribute('aria-pressed', 'false');
    await step.click();
    await expect(step).toHaveAttribute('aria-pressed', 'true');

    // The write landed server-side, not just in local state.
    await expect
      .poll(
        async () =>
          withDb(async (client) => {
            const { rows } = await client.query<{ count: string }>(
              `select count(*) from completion where member_id = $1 and occurrence_date = $2`,
              [child.id, TODAY()]
            );
            return Number(rows[0].count);
          }),
        { timeout: 10_000 }
      )
      .toBe(1);

    await sitterContext.close();
  });

  test('a contributor link cannot tick a member outside its scope', async ({
    page,
    browser,
    family,
  }) => {
    const { inScope, outOfScope, outOfScopeRoutine } = await withDb(async (client) => {
      const [first, second] = await seedMembers(client, family.familyId, [
        { displayName: 'Bram', role: 'child', color: 'orange', sortOrder: 1 },
        { displayName: 'Fenna', role: 'child', color: 'teal', sortOrder: 2 },
      ]);

      const schedule = {
        rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU',
        timeOfDay: '00:00',
        graceDays: 1,
      };

      const [, sibling] = await seedRoutines(client, family.familyId, [
        {
          ownerMemberId: first.id,
          title: 'Avondroutine',
          schedule,
          steps: [{ title: 'Tanden poetsen' }],
        },
        {
          ownerMemberId: second.id,
          title: 'Ochtendroutine',
          schedule,
          steps: [{ title: 'Aankleden' }],
        },
      ]);

      return { inScope: first, outOfScope: second, outOfScopeRoutine: sibling };
    });

    const url = await mintLink(page, {
      role: 'contributor',
      label: 'Oppas',
      memberId: inScope.id,
    });
    const token = url.split('/').pop()!;

    const caregiver = await newAnonymousContext(browser);
    const caregiverPage = await caregiver.newPage();
    await caregiverPage.goto(url);

    // The sibling is not even rendered — scope is a read filter first.
    await expect(caregiverPage.getByText('Ochtendroutine')).toHaveCount(0);

    // Posting directly at the contributor endpoint, bypassing the UI entirely:
    // this is the denial that matters, because the affordance was never the
    // authorization.
    const refused = await caregiverPage.request.post('/api/share/completions', {
      data: {
        token,
        routineId: outOfScopeRoutine.id,
        routineStepId: outOfScopeRoutine.stepIds[0],
        memberId: outOfScope.id,
        occurrenceDate: TODAY(),
        clientId: `e2e-out-of-scope-${outOfScopeRoutine.stepIds[0]}`,
      },
    });

    expect(refused.status()).toBe(403);

    const written = await withDb(async (client) => {
      const { rows } = await client.query<{ count: string }>(
        `select count(*) from completion where member_id = $1`,
        [outOfScope.id]
      );
      return Number(rows[0].count);
    });
    expect(written).toBe(0);

    await caregiver.close();
  });

  test('a viewer-role token cannot post to the contributor endpoint — NB-5', async ({
    page,
    browser,
    family,
  }) => {
    const { child, routine } = await withDb(async (client) => {
      const [seeded] = await seedMembers(client, family.familyId, [
        { displayName: 'Bram', role: 'child', color: 'orange', sortOrder: 1 },
      ]);

      const [seededRoutine] = await seedRoutines(client, family.familyId, [
        {
          ownerMemberId: seeded.id,
          title: 'Avondroutine',
          schedule: {
            rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU',
            timeOfDay: '00:00',
            graceDays: 1,
          },
          steps: [{ title: 'Tanden poetsen' }],
        },
      ]);

      return { child: seeded, routine: seededRoutine };
    });

    const url = await mintLink(page, { role: 'viewer', label: 'Oma', memberId: child.id });
    const token = url.split('/').pop()!;

    const caregiver = await newAnonymousContext(browser);
    const caregiverPage = await caregiver.newPage();
    await caregiverPage.goto(url);

    // The `viewer` grade is `deny` for `completion:write` in the §7 matrix —
    // this is refused by the matrix inside `recordCompletion`, not by any
    // check the route handler makes itself.
    const refused = await caregiverPage.request.post('/api/share/completions', {
      data: {
        token,
        routineId: routine.id,
        routineStepId: routine.stepIds[0],
        memberId: child.id,
        occurrenceDate: TODAY(),
        clientId: `e2e-viewer-role-${routine.stepIds[0]}`,
      },
    });

    expect(refused.status()).toBe(403);

    const written = await withDb(async (client) => {
      const { rows } = await client.query<{ count: string }>(
        `select count(*) from completion where member_id = $1`,
        [child.id]
      );
      return Number(rows[0].count);
    });
    expect(written).toBe(0);

    await caregiver.close();
  });

  test('a revoked token cannot post to the contributor endpoint — NB-5', async ({
    page,
    browser,
    family,
  }) => {
    const { child, routine } = await withDb(async (client) => {
      const [seeded] = await seedMembers(client, family.familyId, [
        { displayName: 'Bram', role: 'child', color: 'orange', sortOrder: 1 },
      ]);

      const [seededRoutine] = await seedRoutines(client, family.familyId, [
        {
          ownerMemberId: seeded.id,
          title: 'Avondroutine',
          schedule: {
            rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU',
            timeOfDay: '00:00',
            graceDays: 1,
          },
          steps: [{ title: 'Tanden poetsen' }],
        },
      ]);

      return { child: seeded, routine: seededRoutine };
    });

    const url = await mintLink(page, { role: 'contributor', label: 'Oppas', memberId: child.id });
    const token = url.split('/').pop()!;

    // Revoked before the caregiver ever gets there — same lifecycle
    // `revokeShareLinkAction` writes from the settings UI.
    await page.goto('/nl/settings/sharing');
    await page.getByTestId('share-revoke').click();
    await page.getByTestId('share-revoke-confirm').click();
    await expect(page.getByTestId('share-link-row')).toHaveAttribute('data-state', 'revoked');

    const caregiver = await newAnonymousContext(browser);
    const caregiverPage = await caregiver.newPage();

    // `resolveShareLink` refuses on the very next request — the resolver
    // never distinguishes revoked from expired from never-minted here either.
    const refused = await caregiverPage.request.post('/api/share/completions', {
      data: {
        token,
        routineId: routine.id,
        routineStepId: routine.stepIds[0],
        memberId: child.id,
        occurrenceDate: TODAY(),
        clientId: `e2e-revoked-${routine.stepIds[0]}`,
      },
    });

    expect(refused.status()).toBe(403);

    const written = await withDb(async (client) => {
      const { rows } = await client.query<{ count: string }>(
        `select count(*) from completion where member_id = $1`,
        [child.id]
      );
      return Number(rows[0].count);
    });
    expect(written).toBe(0);

    await caregiver.close();
  });

  test('a private calendar renders busy-only', async ({ page, browser, family }) => {
    await withDb(async (client) => {
      const owner = await ownerMemberOf(client, family.familyId);
      const calendarId = await seedCalendar(client, family.familyId, owner.id, {
        summary: 'Werk',
        visibility: 'private',
      });

      const start = new Date();
      start.setHours(start.getHours() + 3, 0, 0, 0);

      await seedEvents(client, family.familyId, [
        {
          title: 'Salarisgesprek met de baas',
          calendarId,
          startsAt: start.toISOString(),
          endsAt: new Date(start.getTime() + 3_600_000).toISOString(),
          ownerMemberId: owner.id,
          location: 'Kantoor Amsterdam',
        },
      ]);
    });

    const url = await mintLink(page, { role: 'viewer', label: 'Oma' });

    const caregiver = await newAnonymousContext(browser);
    const caregiverPage = await caregiver.newPage();
    await caregiverPage.goto(url);

    // The block is there — a caregiver has to know the house is busy — but the
    // title and the location are not, anywhere in the document.
    await expect(caregiverPage.getByTestId('share-event').first()).toBeVisible();
    await expect(caregiverPage.locator('[data-busy-only="true"]').first()).toBeVisible();
    await expect(caregiverPage.getByText('Salarisgesprek')).toHaveCount(0);
    await expect(caregiverPage.getByText('Kantoor Amsterdam')).toHaveCount(0);
    expect(await caregiverPage.content()).not.toContain('Salarisgesprek');

    await caregiver.close();
  });

  test('a revoked link returns a friendly gone state, and usage is visible to parents', async ({
    page,
    browser,
    family,
  }) => {
    void family;
    const url = await mintLink(page, { role: 'viewer', label: 'Oma' });

    // One visit, so there is telemetry to read back.
    const caregiver = await newAnonymousContext(browser);
    const caregiverPage = await caregiver.newPage();
    await caregiverPage.goto(url);
    await expect(caregiverPage.getByRole('heading', { level: 1 })).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('share-link-usage')).toContainText('1 keer geopend');

    await page.getByTestId('share-revoke').click();
    await page.getByTestId('share-revoke-confirm').click();
    await expect(page.getByTestId('share-link-row')).toHaveAttribute('data-state', 'revoked');

    // The revoked link, on the very next request from the caregiver's context.
    await caregiverPage.goto(url);
    await expect(caregiverPage.getByText('Deze link werkt niet meer')).toBeVisible();
    // A gone state, not a crash: no stack trace, no error digest.
    expect(await caregiverPage.content()).not.toContain('Application error');

    await caregiver.close();
  });

  test('an expired link returns the same gone state', async ({ page, browser, family }) => {
    const url = await mintLink(page, { role: 'viewer', label: 'Oma' });

    await withDb(async (client) => {
      await client.query(
        `update share_link set expires_at = now() - interval '1 day' where family_id = $1`,
        [family.familyId]
      );
    });

    const caregiver = await newAnonymousContext(browser);
    const caregiverPage = await caregiver.newPage();
    await caregiverPage.goto(url);

    await expect(caregiverPage.getByText('Deze link werkt niet meer')).toBeVisible();
    await caregiver.close();
  });

  test('an unknown token is indistinguishable from an expired one', async ({ browser }) => {
    const caregiver = await newAnonymousContext(browser);
    const caregiverPage = await caregiver.newPage();

    await caregiverPage.goto('/nl/s/2XZ1qsSPBLc0y2i8s8OXY0N2gZ2mLcQOgVaVsGxOaWo');
    await expect(caregiverPage.getByText('Deze link werkt niet meer')).toBeVisible();

    await caregiver.close();
  });

  test('the share tree refuses every mutation at the transport', async ({ browser }) => {
    const caregiver = await newAnonymousContext(browser);

    // A Server Action invocation is a POST to the page that rendered it. The
    // proxy refuses one before the route tree is reached at all.
    const response = await caregiver.request.post(
      '/nl/s/2XZ1qsSPBLc0y2i8s8OXY0N2gZ2mLcQOgVaVsGxOaWo'
    );

    expect(response.status()).toBe(405);
    expect(response.headers()['allow']).toBe('GET, HEAD');

    await caregiver.close();
  });

  test('a share visitor never installs a service worker or caches the page — B-1', async ({
    page,
    browser,
    family,
  }) => {
    void family;
    const url = await mintLink(page, { role: 'viewer', label: 'Oma' });
    const token = url.split('/').pop()!;

    const caregiver = await newAnonymousContext(browser);
    const caregiverPage = await caregiver.newPage();
    await caregiverPage.goto(url);
    await expect(caregiverPage.getByRole('heading', { level: 1 })).toBeVisible();

    // The root `[locale]` layout no longer mounts `ServiceWorkerRegistrar` —
    // it wraps `(share)` too, and a caregiver's browser must never even
    // attempt an install, `network-only` strategy or not.
    const registration = await caregiverPage.evaluate(async () => {
      const existing = await navigator.serviceWorker.getRegistrations();
      return { controller: navigator.serviceWorker.controller !== null, count: existing.length };
    });
    expect(registration.controller).toBe(false);
    expect(registration.count).toBe(0);

    // And nothing was ever written to Cache Storage for this origin from this
    // context — not the schedule, not the token-bearing URL that names it.
    const cacheUrls = await caregiverPage.evaluate(async () => {
      const names = await caches.keys();
      const entries = await Promise.all(
        names.map(async (name) => (await (await caches.open(name)).keys()).map((r) => r.url))
      );
      return entries.flat();
    });
    expect(cacheUrls.filter((entry) => entry.includes('/s/'))).toEqual([]);
    expect(cacheUrls.filter((entry) => entry.includes(token))).toEqual([]);

    await caregiver.close();
  });
});
