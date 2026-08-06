import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '@/server/db/schema';
import { listEvents } from '@/modules/calendar/queries';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * The calendar read path against a real Postgres (M06).
 *
 * The expansion itself is proven in `tests/unit/calendar/expand.test.ts`. What
 * needs a database is the *candidate selection* around it: the SQL predicate
 * that decides which rows are even worth expanding. It has to be generous
 * enough to catch a series that began years before the window (its stored
 * `endsAt` says nothing about which instances land in view) and tight enough
 * not to drag the whole table in — and `array_length(rdates, 1) > 0` is not a
 * predicate a unit test can exercise.
 *
 * The private-calendar redaction is here for the same reason: it depends on a
 * join, so proving it against real rows is the only proof worth having.
 */
describe.skipIf(!databaseUrl)('calendar read path (integration)', () => {
  const { pool, db } = createTestDb();
  const { calendar, event, family, googleAccount } = schema;

  let household: Household;
  let familyCalendarId: string;
  let privateCalendarId: string;
  let readOnlyCalendarId: string;

  const window = {
    from: new Date('2026-03-09T00:00:00.000Z'),
    to: new Date('2026-03-16T00:00:00.000Z'),
  };

  beforeAll(async () => {
    // `listEvents` goes through the app's own `getDb()`, which validates the
    // whole server env at first use. Same shim the Google integration suites
    // use — the values are never exercised, only parsed.
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
    process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

    household = await seedHousehold(db, 'CalendarRead');

    const [account] = await db
      .insert(googleAccount)
      .values({
        familyId: household.familyId,
        ownerMemberId: household.parentId,
        googleUserId: `google-${randomUUID()}`,
        email: 'sanne@example.test',
        scopes: ['https://www.googleapis.com/auth/calendar'],
      })
      .returning();

    const calendars = await db
      .insert(calendar)
      .values([
        {
          familyId: household.familyId,
          googleAccountId: account.id,
          googleCalendarId: `family-${randomUUID()}`,
          summary: 'Gezin',
          color: '#0b8043',
          timeZone: 'Europe/Amsterdam',
          visibility: 'family',
          writable: true,
        },
        {
          familyId: household.familyId,
          googleAccountId: account.id,
          googleCalendarId: `private-${randomUUID()}`,
          summary: 'Werk',
          color: '#a855f7',
          visibility: 'private',
          writable: true,
        },
        {
          familyId: household.familyId,
          googleAccountId: account.id,
          googleCalendarId: `readonly-${randomUUID()}`,
          summary: 'Schoolrooster',
          visibility: 'family',
          writable: false,
        },
      ])
      .returning();

    [familyCalendarId, privateCalendarId, readOnlyCalendarId] = calendars.map((row) => row.id);

    await db.insert(event).values([
      {
        familyId: household.familyId,
        calendarId: familyCalendarId,
        googleEventId: `one-off-${randomUUID()}`,
        title: 'Tandarts',
        startsAt: new Date('2026-03-11T08:00:00.000Z'),
        endsAt: new Date('2026-03-11T09:00:00.000Z'),
        ownerMemberId: household.parentId,
      },
      {
        // Started long before the window; only its rule reaches into it.
        familyId: household.familyId,
        calendarId: familyCalendarId,
        googleEventId: `series-${randomUUID()}`,
        title: 'Papa-week',
        startsAt: new Date('2019-01-07T07:30:00.000Z'),
        endsAt: new Date('2019-01-07T08:30:00.000Z'),
        eventType: 'custody',
        rrule: 'FREQ=WEEKLY;BYDAY=MO',
      },
      {
        // No RRULE at all — reachable only through the RDATE branch.
        familyId: household.familyId,
        calendarId: familyCalendarId,
        googleEventId: `rdate-${randomUUID()}`,
        title: 'Losse herhaling',
        startsAt: new Date('2020-05-04T09:00:00.000Z'),
        endsAt: new Date('2020-05-04T10:00:00.000Z'),
        rdates: ['RDATE;TZID=Europe/Amsterdam:20260312T140000'],
      },
      {
        familyId: household.familyId,
        calendarId: privateCalendarId,
        googleEventId: `private-${randomUUID()}`,
        title: 'Sollicitatiegesprek',
        description: 'Bij een ander bedrijf',
        location: 'Utrecht',
        startsAt: new Date('2026-03-12T09:00:00.000Z'),
        endsAt: new Date('2026-03-12T10:30:00.000Z'),
        ownerMemberId: household.parentId,
      },
      {
        familyId: household.familyId,
        calendarId: readOnlyCalendarId,
        googleEventId: `readonly-${randomUUID()}`,
        title: 'Schoolfoto',
        startsAt: new Date('2026-03-13T08:00:00.000Z'),
        endsAt: new Date('2026-03-13T09:00:00.000Z'),
      },
      {
        // Soft-deleted: the row survives for the sync engine, the view drops it.
        familyId: household.familyId,
        calendarId: familyCalendarId,
        googleEventId: `deleted-${randomUUID()}`,
        title: 'Afgezegd',
        startsAt: new Date('2026-03-11T12:00:00.000Z'),
        endsAt: new Date('2026-03-11T13:00:00.000Z'),
        deletedAt: new Date(),
      },
      {
        // A native event: no calendar, always ours to edit.
        familyId: household.familyId,
        title: 'Eigen notitie',
        startsAt: new Date('2026-03-10T18:00:00.000Z'),
        endsAt: new Date('2026-03-10T19:00:00.000Z'),
        category: 'pink',
        pendingSyncAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(family).where(eq(family.id, household.familyId));
    await pool.end();
  });

  async function read(privateDetail: boolean) {
    return listEvents({ familyId: household.familyId, window, privateDetail });
  }

  it('expands a series that began years before the window', async () => {
    const events = await read(true);
    const instances = events.filter((item) => item.title === 'Papa-week');

    // Mondays 9 March 2026 — the only one inside a single-week window.
    expect(instances).toHaveLength(1);
    expect(instances[0].startsAt.toISOString()).toBe('2026-03-09T07:30:00.000Z');
    expect(instances[0].isRecurringInstance).toBe(true);
    expect(instances[0].recurring).toBe(true);
  });

  it('finds a row whose only recurrence is an RDATE', async () => {
    // This is the `array_length(rdates, 1) > 0` half of the predicate: the row
    // has no RRULE, and its stored dates are six years outside the window.
    const events = await read(true);
    const instances = events.filter((item) => item.title === 'Losse herhaling');

    expect(instances).toHaveLength(1);
    expect(instances[0].startsAt.toISOString()).toBe('2026-03-12T13:00:00.000Z');
  });

  it('omits soft-deleted rows', async () => {
    const events = await read(true);
    expect(events.map((item) => item.title)).not.toContain('Afgezegd');
  });

  it('redacts a private calendar to free/busy when detail is not permitted', async () => {
    const events = await read(false);
    const redacted = events.filter((item) => item.busyOnly);

    expect(redacted).toHaveLength(1);
    // The block keeps its shape in the day; everything identifying is gone.
    expect(redacted[0].startsAt.toISOString()).toBe('2026-03-12T09:00:00.000Z');
    expect(redacted[0].endsAt.toISOString()).toBe('2026-03-12T10:30:00.000Z');
    expect(redacted[0].description).toBeNull();
    expect(redacted[0].location).toBeNull();
    expect(redacted[0].attendeeMemberIds).toEqual([]);
    expect(redacted[0].rrule).toBeNull();
    expect(redacted[0].title).not.toBe('Sollicitatiegesprek');
    // You cannot edit what you are not allowed to read.
    expect(redacted[0].editable).toBe(false);

    const titles = events.map((item) => item.title);
    expect(titles).not.toContain('Sollicitatiegesprek');
  });

  it('shows the same event in full when detail is permitted', async () => {
    const events = await read(true);
    const shown = events.find((item) => item.title === 'Sollicitatiegesprek');

    expect(shown).toBeDefined();
    expect(shown!.busyOnly).toBe(false);
    expect(shown!.location).toBe('Utrecht');
    expect(shown!.editable).toBe(true);
  });

  it('marks a read-only calendar uneditable and a native event editable', async () => {
    const events = await read(true);

    expect(events.find((item) => item.title === 'Schoolfoto')!.editable).toBe(false);
    expect(events.find((item) => item.title === 'Eigen notitie')!.editable).toBe(true);
  });

  it('resolves category from the override, else the calendar colour', async () => {
    const events = await read(true);

    // Explicit per-event override.
    expect(events.find((item) => item.title === 'Eigen notitie')!.category).toBe('pink');
    // Inherited: the family calendar's #0b8043 maps onto the green palette.
    expect(events.find((item) => item.title === 'Tandarts')!.category).toBe('green');
  });

  it('surfaces pendingSyncAt as the flag the sync pip renders from', async () => {
    const events = await read(true);

    expect(events.find((item) => item.title === 'Eigen notitie')!.pendingSync).toBe(true);
    expect(events.find((item) => item.title === 'Tandarts')!.pendingSync).toBe(false);
  });

  it('returns instances in ascending start order', async () => {
    const events = await read(true);
    const starts = events.map((item) => item.startsAt.getTime());

    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });
});
