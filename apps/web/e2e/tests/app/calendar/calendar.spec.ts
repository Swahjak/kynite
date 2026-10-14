import type { Locator, Page } from '@playwright/test';
import { pairHub } from '@e2e/fixtures/hub';
import { openFoldedRows } from '@e2e/utils/timeline';
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

/**
 * The start/end controls are a `DateTimeField` — a labelled group holding a
 * date and a time input — not a single `<input type="datetime-local">`, since
 * a native one renders in the *browser's* locale rather than the household's
 * (`src/components/ui/date-time-field.tsx`). Both halves accept the wire
 * format, so the values below are still ISO.
 */
async function fillWhen(group: Locator, date: string, time: string) {
  // exact: the pickers' "Kies een datum"/"Kies een tijd" buttons substring-match otherwise
  await group.getByLabel('Datum', { exact: true }).fill(date);
  await group.getByLabel('Tijd', { exact: true }).fill(time);
}

/**
 * Open the event dialog through `trigger`, retrying until it is really there.
 *
 * Cause of the lost first click (reproduced 3/36 without the retry): the server
 * renders the *wide* shape (`use-is-wide.ts:46`, server snapshot `true`), the
 * app project is a 390px phone, so hydration swaps the SSR'd chip for the phone
 * layout (`calendar-shell.tsx:95`). A tap in that window hits a node that is
 * about to be replaced. The server cannot know the viewport, so this is not a
 * dead click to fix in `src` — the test waits the swap out instead.
 */
async function openEventDialog(page: Page, trigger: () => Promise<void>) {
  await expect(async () => {
    await trigger();
    await expect(page.getByTestId('event-dialog')).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000, intervals: [250, 500, 1000] });
}

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

      await openEventDialog(page, () => page.getByTestId('event-create').click());

      await page.getByTestId('event-title').fill('Zwemles');
      await fillWhen(page.getByTestId('event-starts-at'), ANCHOR, '16:00');
      await fillWhen(page.getByTestId('event-ends-at'), ANCHOR, '17:00');
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
      await openEventDialog(page, () => page.getByText('Zwemles').first().click());
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

    await openEventDialog(page, () => page.getByTestId('event-create').click());
    await page.getByTestId('event-title').fill('Onmogelijk');
    await fillWhen(page.getByTestId('event-starts-at'), ANCHOR, '17:00');
    await fillWhen(page.getByTestId('event-ends-at'), ANCHOR, '16:00');
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
    await openEventDialog(page, () => instance.click());
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

    // Dragging lives on the wide time grid (`CalendarShell`, `isWide` =
    // min-width 640px); the app project's 390px phone draws the day as a list
    // with nothing to drag, so this test widens its own window.
    await page.setViewportSize({ width: 1024, height: 800 });
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
    await openEventDialog(page, () =>
      page.locator('[data-slot="event-chip"]', { hasText: 'Niet verslepen' }).first().click()
    );

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
    await openEventDialog(page, () => chip.click());
  });
});

test.describe('the today tabs', () => {
  test('the day view orders member columns by sortOrder and carries each member colour', async ({
    page,
    family,
  }) => {
    await withDb(async (client) => {
      // Seeded out of order on purpose: the columns follow `sortOrder`, not
      // insertion order.
      await seedMembers(client, family.familyId, [
        { displayName: 'Daan', role: 'child', color: 'terracotta', sortOrder: 2 },
        { displayName: 'Mila', role: 'child', color: 'orchid', sortOrder: 1 },
      ]);
    });

    // The per-member columns live on the wide day grid (`MemberDayGrid`,
    // `isWide` = min-width 640px); the 390px phone draws the day as a list.
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto(`/nl/calendar?view=day&date=${ANCHOR}`);

    const columns = page.locator('[data-testid="calendar-view-day"] [data-slot="member-column"]');
    await expect(columns).toHaveCount(3);

    // Sign-up's owner is sortOrder 0, so the seeded children follow in order.
    await expect(columns.nth(0)).toContainText('Sanne');
    await expect(columns.nth(1)).toContainText('Mila');
    await expect(columns.nth(2)).toContainText('Daan');

    await expect(columns.nth(1).locator('.border-member-orchid-lijn')).toBeVisible();
    await expect(columns.nth(2).locator('.border-member-terracotta-lijn')).toBeVisible();
  });

  test('the today timeline merges a shared event into one row', async ({ page, family }) => {
    // Today in the *household's* zone, not UTC's — between midnight and 02:00
    // Amsterdam the two disagree and the event would land on yesterday's board.
    const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' })
      .format(new Date())
      .split('-')
      .map(Number);
    const at = (hour: number) => new Date(Date.UTC(year, month - 1, day, hour)).toISOString();

    const ownerName = await withDb(async (client) => {
      const owner = await ownerMemberOf(client, family.familyId);
      // A fourth child who is *not* invited, so the household has someone the
      // event does not belong to — otherwise attendees + owner covers every
      // member and the row collapses to "Iedereen" rather than naming names
      // (the same `everyone` rule `today-tab-dag.tsx` and the strip share).
      const [mila, daan] = await seedMembers(client, family.familyId, [
        { displayName: 'Mila', role: 'child', color: 'orchid', sortOrder: 1 },
        { displayName: 'Daan', role: 'child', color: 'terracotta', sortOrder: 2 },
        { displayName: 'Lars', role: 'child', color: 'petrol', sortOrder: 3 },
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
      return owner.displayName;
    });

    // `/today` is the one chronological timeline: there are no pill tabs to
    // click and no per-device tab choice to survive a reload.
    await page.goto('/nl/today');

    // A run late enough in the day finds this event already "past", which the
    // dag tab collapses under a one-line summary
    // (`today-past-rows.tsx`) — open it before looking for the row so the
    // assertion below holds at any time of day the suite runs.
    const pastToggle = page.getByTestId('today-past-toggle');
    if (await pastToggle.count()) await pastToggle.click();

    // A per-person view would draw this event once per member. The timeline
    // is the merged view and draws it once,
    // with its sub-label naming all three.
    const rows = page.locator('[data-testid="today-timeline-row"]', { hasText: 'Zwemles' });
    await expect(rows).toHaveCount(1);
    // The row draws faces, not names: the names are the stack's accessible
    // label (household roster order).
    await expect(rows.first().getByRole('img', { name: `${ownerName}, Mila, Daan` })).toBeVisible();
  });
});

test.describe('private calendars on the hub', () => {
  async function seedPrivateEvent(familyId: string) {
    // Live, not clock-pinned: it starts now and runs 30 minutes, so at any
    // hour it is "today" and always in the same state. A fixed hour slid from
    // upcoming to live to past through the day, and `TodayTimeline` folds live
    // and past rows behind the toggle, so assertions only held before ~10:00.
    const now = new Date();

    await withDb(async (client) => {
      const owner = await ownerMemberOf(client, familyId);
      const privateCalendar = await seedCalendar(client, familyId, owner.id, {
        summary: 'Werk',
        visibility: 'private',
      });

      await seedEvents(client, familyId, [
        {
          title: 'Sollicitatiegesprek',
          startsAt: now.toISOString(),
          endsAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
          ownerMemberId: owner.id,
          calendarId: privateCalendar,
        },
      ]);
    });
  }

  test('shows the private detail to a signed-in member on the app', async ({ page, family }) => {
    await seedPrivateEvent(family.familyId);

    // The parent's own device: the owner may read their private calendar.
    await page.goto('/nl/today');
    await openFoldedRows(page);
    await expect(
      page.getByTestId('today-timeline-row').filter({ hasText: 'Sollicitatiegesprek' })
    ).toBeVisible();
  });

  test('renders busy-only on the hub', async ({ page, family }) => {
    await seedPrivateEvent(family.familyId);

    // Pair first: a device cookie outranks the account session (M12,
    // `modules/family/principal.ts`).
    await pairHub(page, family.familyId);

    // The wall display: the block is there, the title is not.
    await page.goto('/nl/today');
    await expect(page.getByTestId('hub-board')).toBeVisible();
    await openFoldedRows(page);

    // The row must really be in the DOM before "no title" means anything.
    // `/today` draws `EventRow`s; a free/busy one carries `data-busy` (lock
    // glyph + "Bezet"); the chip's `data-busy-only` is the calendar grids'.
    const busy = page.locator('[data-testid="today-timeline-row"][data-busy="true"]');
    await expect(busy).toHaveCount(1);
    await expect(busy).toContainText('Bezet');
    await expect(page.getByText('Sollicitatiegesprek')).toHaveCount(0);
  });

  test('offers no write affordance on the hub', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    await page.goto('/nl/today');

    await expect(page.getByTestId('hub-board')).toBeVisible();
    await expect(page.getByTestId('event-create')).toHaveCount(0);
    await expect(page.getByTestId('event-dialog')).toHaveCount(0);
  });
});
