import { randomUUID } from 'node:crypto';
import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '@/server/db/schema';
import {
  createTestDb,
  databaseUrl,
  expectRejection,
  seedHousehold,
  type Household,
} from './support/db';

/**
 * Event storage (M04): sync identity, the calendar read predicate, verbatim
 * recurrence and soft deletes. The RRULE *expansion* is M05/M06 work — what is
 * proven here is that the schema round-trips every custody pattern in
 * `docs/architecture.md` §3 without reshaping it.
 */
describe.skipIf(!databaseUrl)('event (integration)', () => {
  const { pool, db } = createTestDb();
  const { calendar, event, family, googleAccount } = schema;

  let household: Household;
  let calendarId: string;
  let otherCalendarId: string;

  beforeAll(async () => {
    household = await seedHousehold(db, 'Events');

    const [account] = await db
      .insert(googleAccount)
      .values({
        familyId: household.familyId,
        ownerMemberId: household.parentId,
        googleUserId: `google-${randomUUID()}`,
        email: 'sarah@example.test',
        scopes: ['https://www.googleapis.com/auth/calendar'],
      })
      .returning();

    const calendars = await db
      .insert(calendar)
      .values([
        {
          familyId: household.familyId,
          googleAccountId: account.id,
          googleCalendarId: 'primary',
          summary: 'Sarah',
          writable: true,
        },
        {
          familyId: household.familyId,
          googleAccountId: account.id,
          googleCalendarId: 'work@group.calendar.google.com',
          summary: 'Werk',
          visibility: 'private',
        },
      ])
      .returning();
    calendarId = calendars[0].id;
    otherCalendarId = calendars[1].id;
  });

  afterAll(async () => {
    await db.delete(family).where(eq(family.id, household.familyId));
    await pool.end();
  });

  it('is unique on (calendarId, googleEventId)', async () => {
    const googleEventId = `evt-${randomUUID()}`;
    const values = {
      familyId: household.familyId,
      calendarId,
      googleEventId,
      title: 'Tandarts',
      startsAt: new Date('2026-03-02T08:00:00Z'),
      endsAt: new Date('2026-03-02T08:30:00Z'),
    };

    await db.insert(event).values(values);

    await expectRejection(db.insert(event).values(values), /event_calendar_google_event_unique/);

    // The same Google id on a *different* calendar is a different event.
    const [onOther] = await db
      .insert(event)
      .values({ ...values, calendarId: otherCalendarId })
      .returning();
    expect(onOther.calendarId).toBe(otherCalendarId);
  });

  it('lets Kynite-native events exist without a calendar or a Google id', async () => {
    const rows = await db
      .insert(event)
      .values([
        {
          familyId: household.familyId,
          title: 'Sterren-beloning',
          eventType: 'play',
          startsAt: new Date('2026-03-04T16:00:00Z'),
          endsAt: new Date('2026-03-04T17:00:00Z'),
        },
        {
          familyId: household.familyId,
          title: 'Nog een native event',
          eventType: 'play',
          startsAt: new Date('2026-03-05T16:00:00Z'),
          endsAt: new Date('2026-03-05T17:00:00Z'),
        },
      ])
      .returning();

    expect(rows.map((row) => row.calendarId)).toEqual([null, null]);
    expect(rows[0].version).toBe(0);
    expect(rows[0].tz).toBe('Europe/Amsterdam');
  });

  it('stores custody recurrence verbatim, with overrides as child rows', async () => {
    const [series] = await db
      .insert(event)
      .values({
        familyId: household.familyId,
        calendarId,
        googleEventId: `evt-${randomUUID()}`,
        title: 'Papaweek',
        eventType: 'family',
        ownerMemberId: household.childId,
        attendeeMemberIds: [household.childId, household.siblingId],
        startsAt: new Date('2026-03-02T15:00:00Z'),
        endsAt: new Date('2026-03-09T15:00:00Z'),
        rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
        exdates: ['20260330T150000Z'],
        rdates: ['20260420T150000Z'],
      })
      .returning();

    const [override] = await db
      .insert(event)
      .values({
        familyId: household.familyId,
        calendarId,
        googleEventId: `evt-${randomUUID()}`,
        title: 'Papaweek (geruild)',
        eventType: 'family',
        recurrenceParentId: series.id,
        startsAt: new Date('2026-03-31T15:00:00Z'),
        endsAt: new Date('2026-04-07T15:00:00Z'),
      })
      .returning();

    const [stored] = await db.select().from(event).where(eq(event.id, series.id));
    expect(stored.rrule).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO');
    expect(stored.exdates).toEqual(['20260330T150000Z']);
    expect(stored.rdates).toEqual(['20260420T150000Z']);
    expect(stored.attendeeMemberIds).toEqual([household.childId, household.siblingId]);
    expect(override.recurrenceParentId).toBe(series.id);

    // Deleting the series takes its overrides with it.
    await db.delete(event).where(eq(event.id, series.id));
    const orphans = await db.select().from(event).where(eq(event.id, override.id));
    expect(orphans).toHaveLength(0);
  });

  it('accepts every custody RRULE from the architecture doc as stored text', async () => {
    const patterns = [
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TU,SA,SU',
      'FREQ=MONTHLY;BYDAY=FR;BYSETPOS=1,3',
    ];

    const rows = await db
      .insert(event)
      .values(
        patterns.map((rrule, i) => ({
          familyId: household.familyId,
          title: `Patroon ${i}`,
          eventType: 'family' as const,
          startsAt: new Date('2026-03-02T15:00:00Z'),
          endsAt: new Date('2026-03-02T16:00:00Z'),
          rrule,
        }))
      )
      .returning();

    expect(rows.map((row) => row.rrule)).toEqual(patterns);
  });

  it('soft-deletes: a Google tombstone keeps the row and its etag', async () => {
    const [row] = await db
      .insert(event)
      .values({
        familyId: household.familyId,
        calendarId,
        googleEventId: `evt-${randomUUID()}`,
        title: 'Afgezegd',
        startsAt: new Date('2026-03-10T08:00:00Z'),
        endsAt: new Date('2026-03-10T09:00:00Z'),
        etag: '"abc123"',
        updatedAtRemote: new Date('2026-03-09T12:00:00Z'),
      })
      .returning();

    await db
      .update(event)
      .set({ deletedAt: new Date(), version: row.version + 1 })
      .where(eq(event.id, row.id));

    const [tombstone] = await db.select().from(event).where(eq(event.id, row.id));
    expect(tombstone.deletedAt).not.toBeNull();
    expect(tombstone.etag).toBe('"abc123"');
    expect(tombstone.version).toBe(1);

    const live = await db
      .select()
      .from(event)
      .where(and(eq(event.id, row.id), isNull(event.deletedAt)));
    expect(live).toHaveLength(0);
  });

  it('serves the (familyId, startsAt) window read', async () => {
    const rows = await db
      .select({ id: event.id })
      .from(event)
      .where(
        and(
          eq(event.familyId, household.familyId),
          gte(event.startsAt, new Date('2026-03-01T00:00:00Z')),
          lt(event.startsAt, new Date('2026-03-03T00:00:00Z')),
          isNull(event.deletedAt)
        )
      );

    expect(rows.length).toBeGreaterThan(0);

    // The index the read was designed around exists in the live database — not
    // just in the drizzle objects (which `tests/unit/schema-invariants` checks).
    const indexes = await db.execute(
      sql`select indexdef from pg_indexes where tablename = 'event' and indexname = 'event_family_starts_at_idx'`
    );
    expect(indexes.rows).toHaveLength(1);
    expect(String((indexes.rows[0] as { indexdef: string }).indexdef)).toMatch(
      /\(family_id, starts_at\)/
    );
  });

  it('drops events when their calendar is unlinked', async () => {
    const [account] = await db
      .insert(googleAccount)
      .values({
        familyId: household.familyId,
        ownerMemberId: household.parentId,
        googleUserId: `google-${randomUUID()}`,
        email: 'ex@example.test',
      })
      .returning();
    const [doomed] = await db
      .insert(calendar)
      .values({
        familyId: household.familyId,
        googleAccountId: account.id,
        googleCalendarId: 'gone',
        summary: 'Weg',
      })
      .returning();
    await db.insert(event).values({
      familyId: household.familyId,
      calendarId: doomed.id,
      googleEventId: `evt-${randomUUID()}`,
      title: 'Verdwijnt',
      startsAt: new Date('2026-03-11T08:00:00Z'),
      endsAt: new Date('2026-03-11T09:00:00Z'),
    });

    await db.delete(googleAccount).where(eq(googleAccount.id, account.id));

    const calendars = await db.select().from(calendar).where(eq(calendar.id, doomed.id));
    const events = await db.select().from(event).where(eq(event.calendarId, doomed.id));

    expect(calendars).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  it('is unique on (googleAccountId, googleCalendarId)', async () => {
    const [account] = await db
      .select()
      .from(googleAccount)
      .where(eq(googleAccount.familyId, household.familyId))
      .limit(1);

    await expectRejection(
      db.insert(calendar).values({
        familyId: household.familyId,
        googleAccountId: account.id,
        googleCalendarId: 'primary',
        summary: 'Dubbel',
      }),
      /calendar_google_account_calendar_unique/
    );
  });
});
