import { pairHub } from '@e2e/fixtures/hub';
import { expect, test } from '@e2e/fixtures/family';
import {
  childrenOf,
  ownerMemberOf,
  readEvent,
  seedCalendar,
  seedEvents,
  seedMembers,
  withDb,
} from '@e2e/utils/seed';

/**
 * M06 acceptance, end to end: the four views, event CRUD, drag-and-drop
 * rescheduling, recurring-series expansion and the single-instance override,
 * per-person columns, and the private-calendar busy-only rule on the hub.
 */

/** A Wednesday, far enough out that "today" never collides with the fixtures. */
const ANCHOR = '2026-03-11';

test.describe('calendar views', () => {
  test('renders all four layouts and switches between them without a reload', async ({
    page,
    family,
  }) => {
    await withDb(async (client) => {
      const owner = await ownerMemberOf(client, family.familyId);
      await seedEvents(client, family.familyId, [
        {
          title: 'Tandarts',
          startsAt: '2026-03-11T08:00:00Z',
          endsAt: '2026-03-11T09:00:00Z',
          ownerMemberId: owner.id,
          eventType: 'health',
        },
      ]);
    });

    await page.goto(`/nl/calendar?view=week&date=${ANCHOR}`);
    await expect(page.getByTestId('calendar-view-week')).toBeVisible();
    await expect(page.getByText('Tandarts').first()).toBeVisible();

    // A full reload would re-run this script; if it survives every switch, the
    // document was never replaced. That is the criterion, tested directly.
    await page.evaluate(() => {
      (window as unknown as { __noReload: boolean }).__noReload = true;
    });

    for (const view of ['day', 'month', 'agenda', 'week'] as const) {
      await page.getByTestId(`view-${view}`).click();
      await expect(page.getByTestId(`calendar-view-${view}`)).toBeVisible();

      expect(
        await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)
      ).toBe(true);
    }

    // The view is still linkable even though switching never navigated.
    expect(new URL(page.url()).searchParams.get('view')).toBe('week');
  });

  test('navigates between periods with the arrows', async ({ page }) => {
    await page.goto(`/nl/calendar?view=month&date=${ANCHOR}`);
    await expect(page.getByTestId('calendar-heading')).toHaveText(/maart 2026/i);

    await page.getByRole('button', { name: 'Volgende periode' }).click();
    await expect(page.getByTestId('calendar-heading')).toHaveText(/april 2026/i);

    await page.getByRole('button', { name: 'Vorige periode' }).click();
    await expect(page.getByTestId('calendar-heading')).toHaveText(/maart 2026/i);
  });
});

test.describe('event CRUD', () => {
  test(
    'creates, edits and deletes an event from the parent app',
    { tag: '@smoke' },
    async ({ page, family }) => {
      await page.goto(`/nl/calendar?view=day&date=${ANCHOR}`);

      await page.getByTestId('event-create').click();
      await expect(page.getByTestId('event-dialog')).toBeVisible();

      await page.getByTestId('event-title').fill('Zwemles');
      await page.getByTestId('event-starts-at').fill('2026-03-11T16:00');
      await page.getByLabel('Eindigt om').fill('2026-03-11T17:00');
      await page.getByTestId('event-save').click();

      await expect(page.getByTestId('event-dialog')).toBeHidden();
      await expect(page.getByText('Zwemles').first()).toBeVisible();

      const created = await withDb(async (client) => {
        const { rows } = await client.query<{ id: string; version: number }>(
          `select id, version from event where family_id = $1 and title = 'Zwemles'`,
          [family.familyId]
        );
        return rows[0];
      });
      expect(created).toBeDefined();
      expect(created.version).toBe(0);

      // Edit: the version must bump.
      await page.getByText('Zwemles').first().click();
      await expect(page.getByTestId('event-dialog')).toBeVisible();
      await page.getByTestId('event-title').fill('Zwemles gevorderden');
      await page.getByTestId('event-save').click();

      await expect(page.getByText('Zwemles gevorderden').first()).toBeVisible();

      const edited = await withDb((client) => readEvent(client, created.id));
      expect(edited.title).toBe('Zwemles gevorderden');
      expect(edited.version).toBe(1);

      // Delete: a soft delete, so the row survives for the sync engine (§3).
      // M18: it is confirmed first — one stray tap on a phone used to be enough
      // to take a custody arrangement off the household's calendar.
      await page.getByText('Zwemles gevorderden').first().click();
      await page.getByTestId('event-delete').click();
      await expect(page.getByTestId('event-delete-confirm')).toBeVisible();
      await page.getByTestId('event-delete-confirm-yes').click();

      await expect(page.getByText('Zwemles gevorderden')).toHaveCount(0);

      const deleted = await withDb((client) => readEvent(client, created.id));
      expect(deleted.deleted_at).not.toBeNull();
    }
  );

  test('rejects an event that ends before it starts', async ({ page }) => {
    await page.goto(`/nl/calendar?view=day&date=${ANCHOR}`);

    await page.getByTestId('event-create').click();
    await page.getByTestId('event-title').fill('Onmogelijk');
    await page.getByTestId('event-starts-at').fill('2026-03-11T17:00');
    await page.getByLabel('Eindigt om').fill('2026-03-11T16:00');
    await page.getByTestId('event-save').click();

    await expect(page.getByRole('alert')).toContainText('eindtijd');
  });
});

test.describe('recurring series', () => {
  test('expands instances across the view window', async ({ page, family }) => {
    await withDb(async (client) => {
      const owner = await ownerMemberOf(client, family.familyId);
      await seedEvents(client, family.familyId, [
        {
          title: 'Papa-week',
          // Monday 2 March 2026, 08:30 Amsterdam.
          startsAt: '2026-03-02T07:30:00Z',
          endsAt: '2026-03-02T08:30:00Z',
          ownerMemberId: owner.id,
          eventType: 'family',
          rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
        },
      ]);
    });

    await page.goto(`/nl/calendar?view=month&date=${ANCHOR}`);

    // March 2026 has alternating Mondays on the 2nd, 16th and 30th.
    await expect(page.getByText('Papa-week')).toHaveCount(3);
  });

  test('editing one occurrence creates a child row and an EXDATE on the parent', async ({
    page,
    family,
  }) => {
    const [parentId] = await withDb(async (client) => {
      const owner = await ownerMemberOf(client, family.familyId);
      return seedEvents(client, family.familyId, [
        {
          title: 'Zwemles',
          startsAt: '2026-03-02T07:30:00Z',
          endsAt: '2026-03-02T08:30:00Z',
          ownerMemberId: owner.id,
          rrule: 'FREQ=WEEKLY;BYDAY=MO',
        },
      ]);
    });

    await page.goto(`/nl/calendar?view=week&date=2026-03-09`);

    // The 9 March instance — generated by the rule, not stored.
    const instance = page.locator('[data-slot="event-chip"][data-recurring]').first();
    await instance.click();

    await expect(page.getByTestId('event-dialog')).toBeVisible();
    // "Only this event" is the default, so a mis-click cannot rewrite a
    // custody schedule.
    await expect(page.getByRole('radio', { name: 'Alleen deze afspraak' })).toBeChecked();

    await page.getByTestId('event-title').fill('Zwemles verzet');
    await page.getByTestId('event-save').click();
    await expect(page.getByTestId('event-dialog')).toBeHidden();

    await withDb(async (client) => {
      const parent = await readEvent(client, parentId);
      // The parent keeps its rule and gains an exception for that instant.
      expect(parent.rrule).toBe('FREQ=WEEKLY;BYDAY=MO');
      expect(parent.exdates).toHaveLength(1);
      expect(parent.exdates[0]).toContain('20260309T083000');

      const children = await childrenOf(client, parentId);
      expect(children).toHaveLength(1);
      expect(children[0].title).toBe('Zwemles verzet');
      // The override is a single instance, never a series of its own.
      expect(children[0].rrule).toBeNull();
    });
  });
});

test.describe('drag and drop', { tag: '@heavy' }, () => {
  test('rescheduling a block updates the times and bumps the version', async ({ page, family }) => {
    const [eventId] = await withDb(async (client) => {
      const owner = await ownerMemberOf(client, family.familyId);
      return seedEvents(client, family.familyId, [
        {
          title: 'Sleepbaar',
          // 10:00–11:00 Amsterdam on the anchor day.
          startsAt: '2026-03-11T09:00:00Z',
          endsAt: '2026-03-11T10:00:00Z',
          ownerMemberId: owner.id,
        },
      ]);
    });

    await page.goto(`/nl/calendar?view=day&date=${ANCHOR}`);

    const block = page.locator('[data-slot="event-chip"]', { hasText: 'Sleepbaar' }).first();
    await expect(block).toBeVisible();

    const box = (await block.boundingBox())!;
    const startX = box.x + box.width / 2;
    const startY = box.y + 8;

    // Two hours down. HOUR_HEIGHT is 56px, so 112px is exactly two rows and
    // lands on a 15-minute snap boundary either way.
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY + 40, { steps: 5 });
    await page.mouse.move(startX, startY + 112, { steps: 10 });
    await page.mouse.up();

    await expect
      .poll(
        async () => {
          const row = await withDb((client) => readEvent(client, eventId));
          return new Date(row.starts_at).toISOString();
        },
        { timeout: 10_000 }
      )
      .toBe('2026-03-11T11:00:00.000Z');

    const moved = await withDb((client) => readEvent(client, eventId));
    // The duration is preserved and the write is versioned.
    expect(new Date(moved.ends_at).toISOString()).toBe('2026-03-11T12:00:00.000Z');
    expect(moved.version).toBe(1);
  });

  test('a click without movement opens the dialog instead of rescheduling', async ({
    page,
    family,
  }) => {
    const [eventId] = await withDb(async (client) => {
      const owner = await ownerMemberOf(client, family.familyId);
      return seedEvents(client, family.familyId, [
        {
          title: 'Niet verslepen',
          startsAt: '2026-03-11T09:00:00Z',
          endsAt: '2026-03-11T10:00:00Z',
          ownerMemberId: owner.id,
        },
      ]);
    });

    await page.goto(`/nl/calendar?view=day&date=${ANCHOR}`);
    await page.locator('[data-slot="event-chip"]', { hasText: 'Niet verslepen' }).first().click();

    await expect(page.getByTestId('event-dialog')).toBeVisible();

    const unchanged = await withDb((client) => readEvent(client, eventId));
    expect(new Date(unchanged.starts_at).toISOString()).toBe('2026-03-11T09:00:00.000Z');
    expect(unchanged.version).toBe(0);
  });
});

test.describe('pending sync', () => {
  test('shows a non-blocking pip and never blocks the view', async ({ page, family }) => {
    await withDb(async (client) => {
      const owner = await ownerMemberOf(client, family.familyId);
      await seedEvents(client, family.familyId, [
        {
          title: 'Wacht op Google',
          startsAt: '2026-03-11T09:00:00Z',
          endsAt: '2026-03-11T10:00:00Z',
          ownerMemberId: owner.id,
          pendingSync: true,
        },
      ]);
    });

    await page.goto(`/nl/calendar?view=day&date=${ANCHOR}`);

    const chip = page.locator('[data-slot="event-chip"][data-pending-sync]').first();
    await expect(chip).toBeVisible();
    await expect(chip.getByTestId('pending-sync-pip')).toBeVisible();

    // Non-blocking: no dialog, no error, and the event is still editable.
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await chip.click();
    await expect(page.getByTestId('event-dialog')).toBeVisible();
  });
});

test.describe('the day board', () => {
  test('orders columns by sortOrder and carries each member colour', async ({ page, family }) => {
    await withDb(async (client) => {
      await seedMembers(client, family.familyId, [
        { displayName: 'Mila', role: 'child', color: 'purple', sortOrder: 1 },
        { displayName: 'Daan', role: 'child', color: 'orange', sortOrder: 2 },
      ]);
    });

    await page.goto('/nl/today');
    // M23: the board opens on the merged list, so the columns are one tap away
    // rather than the landing arrangement.
    await page.getByTestId('day-view-columns').click();

    const columns = page.locator('[data-slot="member-column"]');
    await expect(columns).toHaveCount(3);

    // Sign-up's owner is sortOrder 0, so the seeded children follow in order.
    await expect(columns.nth(0)).toContainText('Sanne');
    await expect(columns.nth(1)).toContainText('Mila');
    await expect(columns.nth(2)).toContainText('Daan');

    await expect(columns.nth(1).locator('.bg-cat-purple-solid')).toBeVisible();
    await expect(columns.nth(2).locator('.bg-cat-orange-solid')).toBeVisible();
  });

  test('merges a shared event into one row and remembers the arrangement', async ({
    page,
    family,
  }) => {
    // Today in the *household's* zone, not UTC's — between midnight and 02:00
    // Amsterdam the two disagree and the event would land on yesterday's board.
    const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' })
      .format(new Date())
      .split('-')
      .map(Number);
    const at = (hour: number) => new Date(Date.UTC(year, month - 1, day, hour)).toISOString();

    await withDb(async (client) => {
      const owner = await ownerMemberOf(client, family.familyId);
      const [mila, daan] = await seedMembers(client, family.familyId, [
        { displayName: 'Mila', role: 'child', color: 'purple', sortOrder: 1 },
        { displayName: 'Daan', role: 'child', color: 'orange', sortOrder: 2 },
      ]);

      await seedEvents(client, family.familyId, [
        {
          title: 'Zwemles',
          startsAt: at(15),
          endsAt: at(16),
          ownerMemberId: mila.id,
          attendeeMemberIds: [daan.id, owner.id],
        },
      ]);
    });

    await page.goto('/nl/today');

    // The columns would draw this event three times, once per member. The
    // merged list draws it once, with all three faces on the row.
    const rows = page.locator('[data-slot="day-board"] [data-slot="event-row"]', {
      hasText: 'Zwemles',
    });
    await expect(rows).toHaveCount(1);
    await expect(
      rows.first().locator('[data-slot="event-row-faces"] [data-slot="avatar"]')
    ).toHaveCount(3);

    // The choice is per device and survives a reload — no round trip, no save.
    await page.getByTestId('day-view-columns').click();
    await expect(page.locator('[data-slot="member-column"]')).toHaveCount(3);

    await page.reload();
    await expect(page.locator('[data-slot="member-column"]')).toHaveCount(3);
    await expect(page.locator('[data-slot="combined-day-list"]')).toHaveCount(0);
  });
});

test.describe('private calendars on the hub', () => {
  test('renders busy-only on the hub while the app shows the detail', async ({ page, family }) => {
    // The seeded day must be the family's *local* today, not UTC's. Between
    // midnight and 02:00 Amsterdam time the two disagree, and building the
    // instant from `getUTCDate()` would seed the event onto yesterday's board —
    // which is a test that fails for two hours a night and passes for
    // twenty-two (M06 carry-forward, fixed here because M10 touches this path).
    const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Amsterdam',
    })
      .format(new Date())
      .split('-')
      .map(Number);
    // 09:00 UTC is 10:00 or 11:00 in Amsterdam — comfortably inside the local
    // day, whichever side of the DST change the run happens on.
    const at = (hour: number) => new Date(Date.UTC(year, month - 1, day, hour)).toISOString();

    await withDb(async (client) => {
      const owner = await ownerMemberOf(client, family.familyId);
      const privateCalendar = await seedCalendar(client, family.familyId, owner.id, {
        summary: 'Werk',
        visibility: 'private',
      });

      await seedEvents(client, family.familyId, [
        {
          title: 'Sollicitatiegesprek',
          startsAt: at(9),
          endsAt: at(10),
          ownerMemberId: owner.id,
          calendarId: privateCalendar,
        },
      ]);
    });

    // The parent's own device: the owner may read their private calendar.
    await page.goto('/nl/today');
    // `.first()` because M19's `/today` shows the next event twice — once as
    // the "up next" hero heading and once as its chip on the timeline. The
    // claim under test is that the title is legible *at all* on the parent's
    // own device; the hub half below still asserts the exact opposite with
    // `toHaveCount(0)`, which is the assertion that has to stay strict.
    await expect(page.getByText('Sollicitatiegesprek').first()).toBeVisible();

    // Now the same browser becomes the wall tablet. Pairing happens *here*,
    // between the two navigations, and not at the top of the test: a device
    // cookie outranks the account session (M12,
    // `modules/family/principal.ts`), so pairing first would have sent the
    // `/nl/today` visit above to the board instead.
    await pairHub(page, family.familyId);

    // The wall display: the block is there, the title is not.
    await page.goto('/nl/hub');
    await expect(page.getByTestId('hub-board')).toBeVisible();
    await expect(page.getByText('Sollicitatiegesprek')).toHaveCount(0);

    // The hub board is `PersonColumns`, whose events are `EventRow`s (M22) —
    // the chip is what the time grids and month cells draw.
    const busy = page.locator('[data-slot="event-row"][data-busy-only]').first();
    await expect(busy).toBeVisible();
    await expect(busy).toContainText('Bezet');
  });

  test('offers no write affordance on the hub', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    await page.goto('/nl/hub');

    await expect(page.getByTestId('hub-board')).toBeVisible();
    await expect(page.getByTestId('event-create')).toHaveCount(0);
    await expect(page.getByTestId('event-dialog')).toHaveCount(0);
  });
});
