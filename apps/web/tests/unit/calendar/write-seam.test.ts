import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Principal } from '@/modules/family';
import { calendar, event, family as familyTable, member as memberTable } from '@/server/db/schema';
import { exdateLine } from '@/modules/calendar/domain/ical';
import type { CreateEventInput } from '@/modules/calendar/write';

/**
 * `createEvent`, `skipEventOccurrence`, `updateEventOccurrence` — the MCP
 * write seams (M-B, M-E) — exercised with a fully mocked `getDb()`, matching
 * the discipline `recordCompletion` documents for a write reachable from more
 * than one entry point: `can()` runs *inside* the seam against whatever
 * `Principal` is passed in, so these tests never touch a cookie or a session
 * — only the explicit principal the MCP route (and, since M-E, the two
 * occurrence-scoped Server Actions) builds.
 *
 * The fake `db` is keyed by *table identity* (`select().from(X)`) rather than
 * by call order, so a test only has to say what each table should answer.
 * `update()` and `transaction()` are recorded the same way `insert()` already
 * was, since the occurrence seams (unlike `createEvent`) both update the
 * parent row and — for `updateEventOccurrence` — pair that with an insert
 * inside a transaction.
 */

const selectRows = vi.hoisted(() => new Map<unknown, unknown[]>());
const insertRows = vi.hoisted(() => ({ current: [] as unknown[] }));
const insertCalls = vi.hoisted(() => ({ count: 0, lastValues: undefined as unknown }));
const updateCalls = vi.hoisted(() => ({ count: 0, lastSet: undefined as unknown }));

function makeFakeDb(): unknown {
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => selectRows.get(table) ?? [],
        }),
      }),
    }),
    insert: () => {
      insertCalls.count += 1;
      return {
        values: (values: unknown) => {
          insertCalls.lastValues = values;
          return { returning: async () => insertRows.current };
        },
      };
    },
    update: () => {
      updateCalls.count += 1;
      return {
        set: (values: unknown) => {
          updateCalls.lastSet = values;
          return { where: async () => {} };
        },
      };
    },
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(makeFakeDb()),
  };
}

vi.mock('@/server/db', () => ({ getDb: () => makeFakeDb() }));

const publish = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@/modules/realtime', () => ({ publish }));

const pushToGoogle = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@/modules/calendar/sync-bridge', () => ({ pushToGoogle }));

// `./write.ts` imports `@/modules/family`, whose barrel re-exports client
// components — which drags next-intl's client navigation into a plain Node
// run (see `tests/integration/routine-completion.test.ts` for the same fix).
// Only `redirect` matters here, and it throws like the real one.
vi.mock('@/i18n/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));

const { createEvent, skipEventOccurrence, updateEventOccurrence } =
  await import('@/modules/calendar/write');

const FAMILY_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_FAMILY_ID = '22222222-2222-4222-8222-222222222222';
const MEMBER_ID = '33333333-3333-4333-8333-333333333333';
const CALENDAR_ID = '44444444-4444-4444-8444-444444444444';

const adultPrincipal: Principal = {
  kind: 'member',
  familyId: FAMILY_ID,
  memberId: MEMBER_ID,
  role: 'adult',
};

const childPrincipal: Principal = {
  kind: 'member',
  familyId: FAMILY_ID,
  memberId: MEMBER_ID,
  role: 'child',
};

const baseInput: CreateEventInput = {
  title: 'Zwemles',
  allDay: true,
  startsAt: '2026-09-10',
  endsAt: '2026-09-10',
  attendeeMemberIds: [],
  eventType: 'other',
  recurrence: 'none',
};

beforeEach(() => {
  selectRows.clear();
  insertRows.current = [];
  insertCalls.count = 0;
  insertCalls.lastValues = undefined;
  updateCalls.count = 0;
  updateCalls.lastSet = undefined;
  publish.mockClear();
  pushToGoogle.mockClear();

  selectRows.set(familyTable, [{ id: FAMILY_ID, timezone: 'Europe/Amsterdam' }]);
});

describe('createEvent', () => {
  it('refuses a principal without event:write', async () => {
    const result = await createEvent(childPrincipal, baseInput);

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(insertCalls.count).toBe(0);
    expect(publish).not.toHaveBeenCalled();
    expect(pushToGoogle).not.toHaveBeenCalled();
  });

  it('refuses a calendarId scoped to another family', async () => {
    // The fake `calendar` table has no row for this family — modelling the
    // real `where(and(eq(calendar.id, x), eq(calendar.familyId, familyId)))`
    // guard, which is exactly what turns a forged cross-family calendar id
    // into "not found" rather than a cross-tenant write.
    selectRows.set(calendar, []);

    const result = await createEvent(adultPrincipal, { ...baseInput, calendarId: CALENDAR_ID });

    expect(result).toEqual({ ok: false, error: 'calendarNotFound' });
    expect(insertCalls.count).toBe(0);
  });

  it('creates the event on the happy path, publishing and pushing to Google', async () => {
    insertRows.current = [{ id: 'new-event-id' }];

    const result = await createEvent(adultPrincipal, baseInput);

    expect(result).toEqual({ ok: true, eventId: 'new-event-id' });
    expect(insertCalls.count).toBe(1);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: FAMILY_ID,
        type: 'event.upserted',
        entity: { id: 'new-event-id' },
      })
    );
    expect(pushToGoogle).toHaveBeenCalledWith('new-event-id');
  });

  it('proves an assignee/attendee is re-scoped to the principal family (member table lookup)', async () => {
    // Not exercised by baseInput (empty attendeeMemberIds); this asserts the
    // member table is consulted at all when one is supplied, and that an
    // unresolvable member id refuses the write rather than writing a dangling
    // reference.
    selectRows.set(memberTable, []);

    const result = await createEvent(adultPrincipal, {
      ...baseInput,
      attendeeMemberIds: [OTHER_FAMILY_ID],
    });

    expect(result).toEqual({ ok: false, error: 'memberNotFound' });
    expect(insertCalls.count).toBe(0);
  });
});

const EVENT_ID = '55555555-5555-4555-8555-555555555555';
const OCCURRENCE_START = '2026-09-10T06:00:00.000Z';

const recurringEventRow = {
  id: EVENT_ID,
  familyId: FAMILY_ID,
  title: 'Zwemles',
  description: null as string | null,
  location: null as string | null,
  startsAt: new Date('2026-09-03T06:00:00.000Z'),
  endsAt: new Date('2026-09-03T07:00:00.000Z'),
  allDay: false,
  tz: 'Europe/Amsterdam',
  ownerMemberId: null as string | null,
  attendeeMemberIds: [] as string[],
  eventType: 'other' as const,
  calendarId: null as string | null,
  rrule: 'FREQ=WEEKLY',
  rdates: [] as string[],
  exdates: [] as string[],
  recurrenceParentId: null as string | null,
  deletedAt: null as Date | null,
};

describe('skipEventOccurrence', () => {
  it('refuses a principal without event:write', async () => {
    const result = await skipEventOccurrence(childPrincipal, {
      eventId: EVENT_ID,
      occurrenceStart: OCCURRENCE_START,
    });

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(updateCalls.count).toBe(0);
    expect(publish).not.toHaveBeenCalled();
    expect(pushToGoogle).not.toHaveBeenCalled();
  });

  it('refuses an event id that resolves to nothing — unknown, or a forged cross-family id', async () => {
    // Same convention as `createEvent`'s cross-family test above: the real
    // `where(and(eq(event.id, x), eq(event.familyId, familyId)))` guard turns
    // both "no such event" and "that event belongs to another family" into
    // an empty result, so both cases are modelled the same way here.
    selectRows.set(event, []);

    const result = await skipEventOccurrence(adultPrincipal, {
      eventId: EVENT_ID,
      occurrenceStart: OCCURRENCE_START,
    });

    expect(result).toEqual({ ok: false, error: 'eventNotFound' });
    expect(updateCalls.count).toBe(0);
  });

  it('refuses a non-recurring event', async () => {
    selectRows.set(event, [{ ...recurringEventRow, rrule: null }]);

    const result = await skipEventOccurrence(adultPrincipal, {
      eventId: EVENT_ID,
      occurrenceStart: OCCURRENCE_START,
    });

    expect(result).toEqual({ ok: false, error: 'notRecurring' });
    expect(updateCalls.count).toBe(0);
  });

  it('appends an EXDATE for the occurrence and publishes/pushes, without deleting the row', async () => {
    selectRows.set(event, [recurringEventRow]);

    const result = await skipEventOccurrence(adultPrincipal, {
      eventId: EVENT_ID,
      occurrenceStart: OCCURRENCE_START,
    });

    expect(result).toEqual({ ok: true });
    expect(updateCalls.count).toBe(1);
    expect(updateCalls.lastSet).toMatchObject({
      exdates: [
        exdateLine(new Date(OCCURRENCE_START), recurringEventRow.tz, recurringEventRow.allDay),
      ],
    });
    // The occurrence is suppressed, never deleted: no row is soft-deleted or
    // inserted for a skip.
    expect(insertCalls.count).toBe(0);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: FAMILY_ID,
        type: 'event.upserted',
        entity: { id: EVENT_ID },
      })
    );
    expect(pushToGoogle).toHaveBeenCalledWith(EVENT_ID);
  });
});

describe('updateEventOccurrence', () => {
  it('refuses a principal without event:write', async () => {
    const result = await updateEventOccurrence(childPrincipal, {
      eventId: EVENT_ID,
      occurrenceStart: OCCURRENCE_START,
      title: 'Zwemles (later)',
    });

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(insertCalls.count).toBe(0);
    expect(updateCalls.count).toBe(0);
    expect(publish).not.toHaveBeenCalled();
    expect(pushToGoogle).not.toHaveBeenCalled();
  });

  it('refuses an event id that resolves to nothing — unknown, or a forged cross-family id', async () => {
    selectRows.set(event, []);

    const result = await updateEventOccurrence(adultPrincipal, {
      eventId: EVENT_ID,
      occurrenceStart: OCCURRENCE_START,
      title: 'Zwemles (later)',
    });

    expect(result).toEqual({ ok: false, error: 'eventNotFound' });
    expect(insertCalls.count).toBe(0);
  });

  it('refuses a non-recurring event', async () => {
    selectRows.set(event, [{ ...recurringEventRow, rrule: null }]);

    const result = await updateEventOccurrence(adultPrincipal, {
      eventId: EVENT_ID,
      occurrenceStart: OCCURRENCE_START,
      title: 'Zwemles (later)',
    });

    expect(result).toEqual({ ok: false, error: 'notRecurring' });
    expect(insertCalls.count).toBe(0);
  });

  it('refuses a soft-deleted parent event', async () => {
    selectRows.set(event, [{ ...recurringEventRow, deletedAt: new Date('2026-09-01') }]);

    const result = await updateEventOccurrence(adultPrincipal, {
      eventId: EVENT_ID,
      occurrenceStart: OCCURRENCE_START,
      title: 'Zwemles (later)',
    });

    expect(result).toEqual({ ok: false, error: 'eventNotFound' });
    expect(insertCalls.count).toBe(0);
  });

  it('refuses an unparseable startsAt/endsAt', async () => {
    selectRows.set(event, [recurringEventRow]);

    const badStart = await updateEventOccurrence(adultPrincipal, {
      eventId: EVENT_ID,
      occurrenceStart: OCCURRENCE_START,
      startsAt: 'not-a-date',
    });
    expect(badStart).toEqual({ ok: false, error: 'invalidInput' });

    const badEnd = await updateEventOccurrence(adultPrincipal, {
      eventId: EVENT_ID,
      occurrenceStart: OCCURRENCE_START,
      endsAt: 'not-a-date',
    });
    expect(badEnd).toEqual({ ok: false, error: 'invalidInput' });

    expect(insertCalls.count).toBe(0);
  });

  it('refuses endsAt before startsAt', async () => {
    selectRows.set(event, [recurringEventRow]);

    const result = await updateEventOccurrence(adultPrincipal, {
      eventId: EVENT_ID,
      occurrenceStart: OCCURRENCE_START,
      startsAt: '2026-09-10T08:00:00.000Z',
      endsAt: '2026-09-10T07:00:00.000Z',
    });

    expect(result).toEqual({ ok: false, error: 'endBeforeStart' });
    expect(insertCalls.count).toBe(0);
  });

  it('takes the child override tz from the family’s current timezone, not the parent row’s stored one', async () => {
    // The family's timezone changed since `recurringEventRow` was created
    // (still stored as 'Europe/Amsterdam') — the child override must pick up
    // the *current* family timezone, exactly as a fresh `resolveInput` call
    // would for `createEvent`/whole-series `updateEventAction`, not the
    // parent's stale one.
    selectRows.set(familyTable, [{ id: FAMILY_ID, timezone: 'America/New_York' }]);
    selectRows.set(event, [recurringEventRow]);
    insertRows.current = [{ id: 'child-event-id' }];

    await updateEventOccurrence(adultPrincipal, {
      eventId: EVENT_ID,
      occurrenceStart: OCCURRENCE_START,
      title: 'Zwemles (later)',
    });

    expect(insertCalls.lastValues).toMatchObject({ tz: 'America/New_York' });
    // The parent's own EXDATE line still uses the parent's *stored* tz — the
    // exception has to match how the parent's own recurrence is expressed,
    // not the family's current setting.
    expect(updateCalls.lastSet).toMatchObject({
      exdates: [
        exdateLine(new Date(OCCURRENCE_START), recurringEventRow.tz, recurringEventRow.allDay),
      ],
    });
  });

  it('inserts a child override row and appends the parent EXDATE, publishing and pushing both', async () => {
    selectRows.set(event, [recurringEventRow]);
    insertRows.current = [{ id: 'child-event-id' }];

    const result = await updateEventOccurrence(adultPrincipal, {
      eventId: EVENT_ID,
      occurrenceStart: OCCURRENCE_START,
      title: 'Zwemles (later)',
    });

    expect(result).toEqual({ ok: true, eventId: EVENT_ID, occurrenceEventId: 'child-event-id' });

    // The child override, not a series of its own — and everything the patch
    // did not touch is carried over from the parent (M-E's "patch minimally"
    // contract).
    expect(insertCalls.count).toBe(1);
    expect(insertCalls.lastValues).toMatchObject({
      familyId: FAMILY_ID,
      title: 'Zwemles (later)',
      rrule: null,
      recurrenceParentId: EVENT_ID,
      ownerMemberId: recurringEventRow.ownerMemberId,
      attendeeMemberIds: recurringEventRow.attendeeMemberIds,
      eventType: recurringEventRow.eventType,
      calendarId: recurringEventRow.calendarId,
      allDay: recurringEventRow.allDay,
    });

    // The parent gains the EXDATE for the replaced slot, same as the skip
    // seam — never a row deletion.
    expect(updateCalls.count).toBe(1);
    expect(updateCalls.lastSet).toMatchObject({
      exdates: [
        exdateLine(new Date(OCCURRENCE_START), recurringEventRow.tz, recurringEventRow.allDay),
      ],
    });

    // Both rows changed, so both publish and both push — the parent's new
    // EXDATE and the child override are two separate facts for a client.
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: FAMILY_ID,
        type: 'event.upserted',
        entity: { id: EVENT_ID },
      })
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: FAMILY_ID,
        type: 'event.upserted',
        entity: { id: 'child-event-id' },
      })
    );
    expect(pushToGoogle).toHaveBeenCalledWith(EVENT_ID);
    expect(pushToGoogle).toHaveBeenCalledWith('child-event-id');
  });
});
