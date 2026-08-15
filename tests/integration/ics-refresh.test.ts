import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '@/server/db/schema';
import { listEvents } from '@/modules/calendar/queries';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * The subscription ingest path against a real Postgres (M25).
 *
 * The parsing and the SSRF guard are proven in the unit suite; what needs a
 * database is everything the design's central claim rests on — that a feed's
 * events are *ordinary events on an ordinary calendar row*:
 *
 * - a refresh imports them, and the calendar read path returns them like any
 *   other calendar's, read-only;
 * - a second refresh of the same feed updates rows rather than duplicating
 *   them (the `(calendar_id, source_uid)` unique index doing its job);
 * - an event that leaves the feed leaves the board;
 * - a *failed* refresh keeps every event and records why;
 * - unsubscribing takes the calendar, the subscription and the events with it,
 *   by cascade rather than by three deletes that could drift apart.
 *
 * The network is the one thing faked: `refreshSubscription` takes the same
 * `fetchImpl` seam the unit tests use, so the HTTP boundary is a function and
 * everything below it is real.
 */

const AMS = 'Europe/Amsterdam';

function calendarBody(events: string[]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//school//EN',
    'X-WR-CALNAME:Schoolagenda',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

const VAKANTIE = [
  'BEGIN:VEVENT',
  'UID:vakantie-1',
  'SUMMARY:Voorjaarsvakantie',
  'DTSTART;VALUE=DATE:20260216',
  'DTEND;VALUE=DATE:20260223',
  'END:VEVENT',
].join('\r\n');

const STUDIEDAG = [
  'BEGIN:VEVENT',
  'UID:studiedag-1',
  'SUMMARY:Studiedag',
  'DTSTART;VALUE=DATE:20260302',
  'DTEND;VALUE=DATE:20260303',
  'END:VEVENT',
].join('\r\n');

const OUDERAVOND = [
  'BEGIN:VEVENT',
  'UID:ouderavond-1',
  'SUMMARY:Ouderavond',
  'DTSTART;TZID=Europe/Amsterdam:20260304T190000',
  'DTEND;TZID=Europe/Amsterdam:20260304T203000',
  'END:VEVENT',
].join('\r\n');

/** A `fetchImpl` that always answers with this body. */
function serving(body: string, headers: Record<string, string> = {}) {
  return (async () =>
    new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/calendar', ...headers },
    })) as unknown as typeof fetch;
}

const publicDns = async () => ['93.184.216.34'];

describe.skipIf(!databaseUrl)('ICS subscription refresh (integration)', () => {
  const { pool, db } = createTestDb();
  const { calendar, event, icsSubscription } = schema;

  let household: Household;
  let calendarId: string;
  let subscriptionId: string;
  let refresh: typeof import('@/modules/ics/refresh');

  beforeAll(async () => {
    // The slice goes through the app's own `getDb()`, which validates the whole
    // server env at first use — the same shim every other integration suite
    // uses. The values are parsed, never exercised.
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
    process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

    refresh = await import('@/modules/ics/refresh');
    household = await seedHousehold(db, 'IcsRefresh');
  });

  afterAll(async () => {
    await db.delete(schema.family).where(eq(schema.family.id, household.familyId));
    await pool.end();
  });

  beforeEach(async () => {
    await db.delete(calendar).where(eq(calendar.familyId, household.familyId));

    const [row] = await db
      .insert(calendar)
      .values({
        familyId: household.familyId,
        summary: 'Schoolagenda',
        color: '#3b82f6',
        timeZone: AMS,
        writable: false,
        syncEnabled: true,
      })
      .returning();
    calendarId = row.id;

    const [subscription] = await db
      .insert(icsSubscription)
      .values({
        familyId: household.familyId,
        calendarId,
        url: 'https://school.example/agenda.ics',
      })
      .returning();
    subscriptionId = subscription.id;
  });

  async function storedEvents() {
    return db.select().from(event).where(eq(event.calendarId, calendarId)).orderBy(event.startsAt);
  }

  it('imports a feed and stamps the subscription', async () => {
    const outcome = await refresh.refreshSubscription(subscriptionId, {
      fetchImpl: serving(calendarBody([VAKANTIE, STUDIEDAG, OUDERAVOND]), {
        etag: 'W/"v1"',
        'last-modified': 'Mon, 02 Mar 2026 06:00:00 GMT',
      }),
      resolveHost: publicDns,
    });

    expect(outcome).toEqual({ status: 'synced', imported: 3, removed: 0 });

    const rows = await storedEvents();
    expect(rows.map((row) => row.title)).toEqual(['Voorjaarsvakantie', 'Studiedag', 'Ouderavond']);
    // All-day rows keep the zoneless UTC-midnight convention, and the timed one
    // remembers the zone it was published in.
    expect(rows[0].allDay).toBe(true);
    expect(rows[0].startsAt.toISOString()).toBe('2026-02-16T00:00:00.000Z');
    expect(rows[2].allDay).toBe(false);
    expect(rows[2].tz).toBe(AMS);
    // No attribution and no type: the calendar's `default_type` decides (M23).
    expect(rows[2].eventType).toBeNull();
    expect(rows[2].ownerMemberId).toBeNull();

    const [subscription] = await db
      .select()
      .from(icsSubscription)
      .where(eq(icsSubscription.id, subscriptionId));

    expect(subscription.etag).toBe('W/"v1"');
    expect(subscription.lastModified).toBe('Mon, 02 Mar 2026 06:00:00 GMT');
    expect(subscription.lastSyncedAt).not.toBeNull();
    expect(subscription.lastError).toBeNull();
  });

  it('shows the imported events on the calendar read path, read-only', async () => {
    await refresh.refreshSubscription(subscriptionId, {
      fetchImpl: serving(calendarBody([OUDERAVOND])),
      resolveHost: publicDns,
    });

    const events = await listEvents({
      familyId: household.familyId,
      window: {
        from: new Date('2026-03-01T00:00:00.000Z'),
        to: new Date('2026-03-31T00:00:00.000Z'),
      },
      privateDetail: true,
    });

    const ouderavond = events.find((entry) => entry.title === 'Ouderavond');
    expect(ouderavond).toBeDefined();
    // The point of the whole design: no view had to learn about feeds, and the
    // read-only-ness a subscription needs is the `writable: false` column every
    // surface already reads.
    expect(ouderavond?.editable).toBe(false);
    expect(ouderavond?.calendarSummary).toBe('Schoolagenda');
  });

  it('updates rows in place on a second refresh rather than duplicating them', async () => {
    await refresh.refreshSubscription(subscriptionId, {
      fetchImpl: serving(calendarBody([STUDIEDAG])),
      resolveHost: publicDns,
    });
    const [before] = await storedEvents();

    const moved = STUDIEDAG.replace('20260302', '20260309')
      .replace('20260303', '20260310')
      .replace('Studiedag', 'Studiedag (verplaatst)');

    const outcome = await refresh.refreshSubscription(subscriptionId, {
      fetchImpl: serving(calendarBody([moved])),
      resolveHost: publicDns,
    });

    expect(outcome).toEqual({ status: 'synced', imported: 1, removed: 0 });

    const rows = await storedEvents();
    expect(rows).toHaveLength(1);
    // Same row: the upsert key is (calendar_id, source_uid), so a school moving
    // a studiedag is an update, not a second event beside the first.
    expect(rows[0].id).toBe(before.id);
    expect(rows[0].title).toBe('Studiedag (verplaatst)');
    expect(rows[0].startsAt.toISOString()).toBe('2026-03-09T00:00:00.000Z');
  });

  it('removes an event that has left the feed, and only feed-owned rows', async () => {
    await refresh.refreshSubscription(subscriptionId, {
      fetchImpl: serving(calendarBody([VAKANTIE, STUDIEDAG])),
      resolveHost: publicDns,
    });

    const outcome = await refresh.refreshSubscription(subscriptionId, {
      fetchImpl: serving(calendarBody([VAKANTIE])),
      resolveHost: publicDns,
    });

    expect(outcome).toEqual({ status: 'synced', imported: 1, removed: 1 });
    expect((await storedEvents()).map((row) => row.sourceUid)).toEqual(['vakantie-1']);
  });

  it('empties the calendar when the feed itself goes empty', async () => {
    await refresh.refreshSubscription(subscriptionId, {
      fetchImpl: serving(calendarBody([VAKANTIE, STUDIEDAG])),
      resolveHost: publicDns,
    });

    const outcome = await refresh.refreshSubscription(subscriptionId, {
      fetchImpl: serving(calendarBody([])),
      resolveHost: publicDns,
    });

    expect(outcome).toEqual({ status: 'synced', imported: 0, removed: 2 });
    expect(await storedEvents()).toHaveLength(0);
  });

  it('keeps the events and records the reason when a refresh fails', async () => {
    await refresh.refreshSubscription(subscriptionId, {
      fetchImpl: serving(calendarBody([VAKANTIE, STUDIEDAG])),
      resolveHost: publicDns,
    });

    const outcome = await refresh.refreshSubscription(subscriptionId, {
      fetchImpl: (async () => new Response('down', { status: 503 })) as unknown as typeof fetch,
      resolveHost: publicDns,
    });

    expect(outcome).toEqual({ status: 'failed', error: 'httpError' });
    // The whole failure policy in one assertion: a school's server being down
    // for an afternoon must never empty a family's holiday list.
    expect(await storedEvents()).toHaveLength(2);

    const [subscription] = await db
      .select()
      .from(icsSubscription)
      .where(eq(icsSubscription.id, subscriptionId));
    expect(subscription.lastError).toBe('httpError');
    expect(subscription.lastErrorAt).not.toBeNull();
  });

  it('refuses a feed whose host resolves into a private range, without touching the rows', async () => {
    await refresh.refreshSubscription(subscriptionId, {
      fetchImpl: serving(calendarBody([VAKANTIE])),
      resolveHost: publicDns,
    });

    const outcome = await refresh.refreshSubscription(subscriptionId, {
      fetchImpl: serving(calendarBody([])),
      resolveHost: async () => ['169.254.169.254'],
    });

    expect(outcome).toEqual({ status: 'failed', error: 'urlPrivateHost' });
    expect(await storedEvents()).toHaveLength(1);
  });

  it('treats a 304 as success and leaves the events alone', async () => {
    await refresh.refreshSubscription(subscriptionId, {
      fetchImpl: serving(calendarBody([VAKANTIE]), { etag: 'W/"v1"' }),
      resolveHost: publicDns,
    });

    const outcome = await refresh.refreshSubscription(subscriptionId, {
      fetchImpl: (async () => new Response(null, { status: 304 })) as unknown as typeof fetch,
      resolveHost: publicDns,
    });

    expect(outcome).toEqual({ status: 'unchanged' });
    expect(await storedEvents()).toHaveLength(1);
  });

  it('skips a paused subscription entirely', async () => {
    await db.update(calendar).set({ syncEnabled: false }).where(eq(calendar.id, calendarId));

    expect(
      await refresh.refreshSubscription(subscriptionId, {
        fetchImpl: serving(calendarBody([VAKANTIE])),
        resolveHost: publicDns,
      })
    ).toEqual({ status: 'skipped', reason: 'disabled' });

    expect(await storedEvents()).toHaveLength(0);
  });

  it('stores an override instance as a child of its series', async () => {
    const series = [
      'BEGIN:VEVENT',
      'UID:zwemles',
      'SUMMARY:Zwemles',
      'DTSTART;TZID=Europe/Amsterdam:20260302T160000',
      'DTEND;TZID=Europe/Amsterdam:20260302T164500',
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:zwemles',
      'RECURRENCE-ID;TZID=Europe/Amsterdam:20260309T160000',
      'SUMMARY:Zwemles (later)',
      'DTSTART;TZID=Europe/Amsterdam:20260309T173000',
      'DTEND;TZID=Europe/Amsterdam:20260309T181500',
      'END:VEVENT',
    ].join('\r\n');

    await refresh.refreshSubscription(subscriptionId, {
      fetchImpl: serving(calendarBody([series])),
      resolveHost: publicDns,
    });

    const rows = await storedEvents();
    const master = rows.find((row) => row.sourceUid === 'zwemles');
    const override = rows.find((row) => row.sourceUid !== 'zwemles');

    expect(master?.rrule).toBe('FREQ=WEEKLY;BYDAY=MO');
    expect(override?.recurrenceParentId).toBe(master?.id);
    expect(override?.recurrenceOriginalStart?.toISOString()).toBe('2026-03-09T15:00:00.000Z');
  });

  it('cascades: removing the calendar removes the subscription and its events', async () => {
    await refresh.refreshSubscription(subscriptionId, {
      fetchImpl: serving(calendarBody([VAKANTIE, STUDIEDAG])),
      resolveHost: publicDns,
    });

    await db.delete(calendar).where(eq(calendar.id, calendarId));

    expect(
      await db.select().from(icsSubscription).where(eq(icsSubscription.id, subscriptionId))
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(event)
        .where(and(eq(event.familyId, household.familyId), eq(event.calendarId, calendarId)))
    ).toHaveLength(0);
  });
});
