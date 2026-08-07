import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { syncCalendar } from '@/modules/google/domain/sync-engine';
import type { CalendarSyncState, MemberDirectory } from '@/modules/google/domain/types';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';
import { createFakeApi } from '../unit/google/support/fake-api';
import { googleEvent } from '../unit/google/support/fixtures';

/**
 * M18, against a real Postgres through the drizzle store: what a Google sync
 * actually *writes* into `event.owner_member_id` / `event.attendee_member_ids`,
 * and what it refuses to write at all.
 *
 * The unit suite (`tests/unit/google/attribution.test.ts`) proves the matching
 * rule. This proves the two things only the database can: that the columns
 * receive it, and that the additive-update rule in `store.ts` protects a
 * parent's own attribution from being erased by the next pass.
 */
describe.skipIf(!databaseUrl)('google attribution (integration)', () => {
  const { pool, db } = createTestDb();

  let household: Household;
  let accountId: string;
  let calendarId: string;
  let subscriptionCalendarId: string;
  let secondParentId: string;
  let store: typeof import('@/modules/google/store');

  const PARENT_EMAIL = 'sarah@example.test';
  const SECOND_EMAIL = 'jeroen@example.test';

  const directory: MemberDirectory = {
    memberIdFor(email) {
      const table: Record<string, string> = {
        [PARENT_EMAIL]: household.parentId,
        [SECOND_EMAIL]: secondParentId,
      };
      return table[email.toLowerCase()] ?? null;
    },
  };

  const calendarState = (): CalendarSyncState => ({
    id: calendarId,
    familyId: household.familyId,
    googleCalendarId: 'family@group.calendar.google.com',
    syncToken: null,
    ownerMemberId: household.parentId,
    isPrimary: true,
  });

  const emit = async () => {};

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
    process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
    store = await import('@/modules/google/store');

    household = await seedHousehold(db, 'GoogleAttribution');

    const [second] = await db
      .insert(schema.member)
      .values({
        familyId: household.familyId,
        displayName: 'Jeroen',
        role: 'adult',
        color: 'blue',
        sortOrder: 3,
      })
      .returning();
    secondParentId = second.id;

    const [account] = await db
      .insert(schema.googleAccount)
      .values({
        familyId: household.familyId,
        ownerMemberId: household.parentId,
        googleUserId: `google-${randomUUID()}`,
        email: PARENT_EMAIL,
      })
      .returning();
    accountId = account.id;

    const [calendar] = await db
      .insert(schema.calendar)
      .values({
        familyId: household.familyId,
        googleAccountId: accountId,
        googleCalendarId: 'family@group.calendar.google.com',
        summary: 'Gezin',
        isPrimary: true,
      })
      .returning();
    calendarId = calendar.id;

    const [subscription] = await db
      .insert(schema.calendar)
      .values({
        familyId: household.familyId,
        googleAccountId: accountId,
        googleCalendarId: 'nl.dutch#holiday@group.v.calendar.google.com',
        summary: 'Nederlandse feestdagen',
        isPrimary: false,
      })
      .returning();
    subscriptionCalendarId = subscription.id;
  });

  afterAll(async () => {
    await db.delete(schema.family).where(eq(schema.family.id, household.familyId));
    await pool.end();
  });

  async function rowFor(googleEventId: string) {
    const [row] = await db
      .select()
      .from(schema.event)
      .where(eq(schema.event.googleEventId, googleEventId));
    return row;
  }

  async function sync(items: Parameters<typeof googleEvent>[0][], syncToken = randomUUID()) {
    const api = createFakeApi({
      listEvents: [{ items: items.map((item) => googleEvent(item)), nextSyncToken: syncToken }],
    });

    return syncCalendar({
      calendar: calendarState(),
      api,
      store: store.syncStore,
      emit,
      directory,
    });
  }

  it('lands a matched attendee, and the calendar owner, in the member columns', async () => {
    await sync([
      {
        id: 'attr-matched',
        summary: 'Ouderavond',
        attendees: [{ email: SECOND_EMAIL }],
      },
    ]);

    const row = await rowFor('attr-matched');
    // The calendar's owner is a participant of everything on their calendar;
    // the matched attendee joins them. Both keys drive `person-columns.tsx`.
    expect(row.attendeeMemberIds.sort()).toEqual([household.parentId, secondParentId].sort());
    expect(row.ownerMemberId).toBe(household.parentId);
  });

  it('ignores an attendee who belongs to nobody in the family', async () => {
    await sync([
      {
        id: 'attr-unmatched',
        summary: 'Tandarts',
        attendees: [{ email: 'receptie@tandarts.example' }],
      },
    ]);

    const row = await rowFor('attr-unmatched');
    // The dentist invented no member, and did not stop the calendar owner from
    // being attributed.
    expect(row.attendeeMemberIds).toEqual([household.parentId]);
  });

  it('resolves multiple attendees at once, matched and unmatched together', async () => {
    await sync([
      {
        id: 'attr-multiple',
        summary: 'Verjaardag',
        organizer: { email: SECOND_EMAIL },
        attendees: [
          { email: PARENT_EMAIL },
          { email: SECOND_EMAIL.toUpperCase() },
          { email: 'buurvrouw@example.org' },
          { email: 'zaal@example.org', resource: true },
        ],
      },
    ]);

    const row = await rowFor('attr-multiple');
    expect(row.attendeeMemberIds.sort()).toEqual([household.parentId, secondParentId].sort());
    // A matched organizer owns the row, over the calendar's owner.
    expect(row.ownerMemberId).toBe(secondParentId);
  });

  it('never erases attribution on a pass that resolved nobody', async () => {
    // The push echo path: our own write comes back from Google carrying no
    // attendees at all, because we never send any. Writing that through would
    // silently un-assign an event a parent had just assigned in the form.
    await sync([{ id: 'attr-keep', summary: 'Zwemles', attendees: [{ email: SECOND_EMAIL }] }]);

    const api = createFakeApi({
      listEvents: [
        {
          items: [
            googleEvent({ id: 'attr-keep', summary: 'Zwemles (gewijzigd)', etag: '"etag-2"' }),
          ],
          nextSyncToken: randomUUID(),
        },
      ],
    });

    await syncCalendar({
      calendar: { ...calendarState(), ownerMemberId: null },
      api,
      store: store.syncStore,
      emit,
      // No directory at all — the unattributed pass.
    });

    const row = await rowFor('attr-keep');
    expect(row.title).toBe('Zwemles (gewijzigd)');
    expect(row.attendeeMemberIds.sort()).toEqual([household.parentId, secondParentId].sort());
    expect(row.ownerMemberId).toBe(household.parentId);
  });

  it('never overwrites an owner a parent chose, however the next pass resolves', async () => {
    // The regression this exists for: `attributeEvent` almost always resolves
    // *somebody* (organizer, else the calendar owner), so an ordinary remote
    // edit — a new etag, a 410 full resync, a calendar switched off and back on
    // — used to overwrite the parent's own answer with Google's every time.
    await sync([{ id: 'attr-owner-wins', summary: 'Zwemles' }]);

    // The parent opens the event and puts it in the child's column.
    await db
      .update(schema.event)
      .set({ ownerMemberId: household.childId })
      .where(eq(schema.event.googleEventId, 'attr-owner-wins'));

    // Google hands the event back changed, and says the parent organizes it.
    await sync([
      {
        id: 'attr-owner-wins',
        summary: 'Zwemles (verzet)',
        etag: '"etag-remote-2"',
        organizer: { email: PARENT_EMAIL },
        attendees: [{ email: SECOND_EMAIL }],
      },
    ]);

    const row = await rowFor('attr-owner-wins');
    expect(row.title).toBe('Zwemles (verzet)');
    // The column a parent set is theirs. Sync only ever fills a *null* owner.
    expect(row.ownerMemberId).toBe(household.childId);
    // Attendees stay additive: the pass adds who it matched and removes nobody.
    expect(row.attendeeMemberIds.sort()).toEqual([household.parentId, secondParentId].sort());
  });

  it('leaves a subscription’s events unattributed — a holiday is nobody’s appointment', async () => {
    const api = createFakeApi({
      listEvents: [
        {
          items: [googleEvent({ id: 'attr-holiday', summary: 'Koningsdag' })],
          nextSyncToken: randomUUID(),
        },
      ],
    });

    await syncCalendar({
      calendar: {
        id: subscriptionCalendarId,
        familyId: household.familyId,
        googleCalendarId: 'nl.dutch#holiday@group.v.calendar.google.com',
        syncToken: null,
        // Same account, same owner — and not the account's own calendar.
        ownerMemberId: household.parentId,
        isPrimary: false,
      },
      api,
      store: store.syncStore,
      emit,
      directory,
    });

    const row = await rowFor('attr-holiday');
    expect(row.ownerMemberId).toBeNull();
    expect(row.attendeeMemberIds).toEqual([]);
  });
});

describe.skipIf(!databaseUrl)('google status-only events (integration)', () => {
  const { pool, db } = createTestDb();

  let household: Household;
  let calendarId: string;
  let store: typeof import('@/modules/google/store');

  const calendarState = (): CalendarSyncState => ({
    id: calendarId,
    familyId: household.familyId,
    googleCalendarId: 'work@example.test',
    syncToken: null,
    ownerMemberId: household.parentId,
  });

  const emit = async () => {};

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
    process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
    store = await import('@/modules/google/store');

    household = await seedHousehold(db, 'GoogleStatusOnly');

    const [account] = await db
      .insert(schema.googleAccount)
      .values({
        familyId: household.familyId,
        ownerMemberId: household.parentId,
        googleUserId: `google-${randomUUID()}`,
        email: 'work@example.test',
      })
      .returning();

    const [calendar] = await db
      .insert(schema.calendar)
      .values({
        familyId: household.familyId,
        googleAccountId: account.id,
        googleCalendarId: 'work@example.test',
        summary: 'Werk',
      })
      .returning();
    calendarId = calendar.id;
  });

  afterAll(async () => {
    await db.delete(schema.family).where(eq(schema.family.id, household.familyId));
    await pool.end();
  });

  it('imports the real appointment and none of the status entries', async () => {
    const api = createFakeApi({
      listEvents: [
        {
          items: [
            googleEvent({ id: 'work-real', summary: 'Sprint review', eventType: 'default' }),
            googleEvent({ id: 'work-location', eventType: 'workingLocation', summary: 'Thuis' }),
            googleEvent({ id: 'work-focus', eventType: 'focusTime', summary: 'Focus' }),
            googleEvent({ id: 'work-ooo', eventType: 'outOfOffice', summary: 'Vrij' }),
          ],
          nextSyncToken: 'token-status',
        },
      ],
    });

    const result = await syncCalendar({
      calendar: calendarState(),
      api,
      store: store.syncStore,
      emit,
    });

    expect(result.upserted).toBe(1);

    const rows = await db
      .select({ googleEventId: schema.event.googleEventId })
      .from(schema.event)
      .where(eq(schema.event.calendarId, calendarId));

    expect(rows.map((row) => row.googleEventId)).toEqual(['work-real']);
  });

  it('removes a status entry that a pre-M18 sync had already imported', async () => {
    // The repair case: the filter that stops new ones would leave yesterday's
    // "Working location: Home" on the wall forever without this.
    await db.insert(schema.event).values({
      familyId: household.familyId,
      calendarId,
      googleEventId: 'work-legacy-location',
      title: 'Werklocatie: Thuis',
      startsAt: new Date('2026-08-07T07:00:00.000Z'),
      endsAt: new Date('2026-08-07T17:00:00.000Z'),
      allDay: true,
    });

    const api = createFakeApi({
      listEvents: [
        {
          items: [
            googleEvent({
              id: 'work-legacy-location',
              eventType: 'workingLocation',
              summary: 'Thuis',
            }),
          ],
          nextSyncToken: 'token-status-2',
        },
      ],
    });

    const result = await syncCalendar({
      calendar: { ...calendarState(), syncToken: 'token-status' },
      api,
      store: store.syncStore,
      emit,
    });

    expect(result.deleted).toBe(1);

    const [row] = await db
      .select({ deletedAt: schema.event.deletedAt })
      .from(schema.event)
      .where(eq(schema.event.googleEventId, 'work-legacy-location'));

    expect(row.deletedAt).not.toBeNull();
  });
});
