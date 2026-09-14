import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Principal } from '@/modules/family';
import { calendar, event, family as familyTable } from '@/server/db/schema';

/**
 * `updateEvent`/`deleteEvent` — the "whole event/whole series" write seams
 * (M-F), as distinct from `updateEventOccurrence`/`skipEventOccurrence`
 * covered by `./write-seam.test.ts`. Same fake-`getDb()` discipline as that
 * file: the fake is keyed by table identity, `can()` runs inside the seam
 * against whatever `Principal` is passed in, and every table the seam reads
 * is modelled explicitly rather than assumed.
 */

const selectRows = vi.hoisted(() => new Map<unknown, unknown[]>());
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
    update: () => {
      updateCalls.count += 1;
      return {
        set: (values: unknown) => {
          updateCalls.lastSet = values;
          return { where: async () => {} };
        },
      };
    },
  };
}

vi.mock('@/server/db', () => ({ getDb: () => makeFakeDb() }));

const publish = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@/modules/realtime', () => ({ publish }));

const pushToGoogle = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@/modules/calendar/sync-bridge', () => ({ pushToGoogle }));

// Same fix as `./write-seam.test.ts`: `./write.ts` imports `@/modules/family`,
// whose barrel re-exports client components that drag next-intl's client
// navigation into a plain Node run.
vi.mock('@/i18n/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));

const { updateEvent, deleteEvent } = await import('@/modules/calendar/write');

const FAMILY_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '33333333-3333-4333-8333-333333333333';
const EVENT_ID = '55555555-5555-4555-8555-555555555555';
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

const eventRow = {
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
  rrule: null as string | null,
  rdates: [] as string[],
  exdates: [] as string[],
  recurrenceParentId: null as string | null,
  deletedAt: null as Date | null,
  googleEventId: null as string | null,
};

beforeEach(() => {
  selectRows.clear();
  updateCalls.count = 0;
  updateCalls.lastSet = undefined;
  publish.mockClear();
  pushToGoogle.mockClear();

  selectRows.set(familyTable, [{ id: FAMILY_ID, timezone: 'Europe/Amsterdam' }]);
  selectRows.set(event, [eventRow]);
});

describe('updateEvent', () => {
  it('refuses a principal without event:write', async () => {
    const result = await updateEvent(childPrincipal, { eventId: EVENT_ID, title: 'Later' });

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(updateCalls.count).toBe(0);
    expect(publish).not.toHaveBeenCalled();
    expect(pushToGoogle).not.toHaveBeenCalled();
  });

  it('refuses an event id that resolves to nothing — unknown, or a forged cross-family id', async () => {
    // Same convention as `write-seam.test.ts`: the real
    // `where(and(eq(event.id, x), eq(event.familyId, familyId)))` guard turns
    // both "no such event" and "that event belongs to another family" into an
    // empty result.
    selectRows.set(event, []);

    const result = await updateEvent(adultPrincipal, { eventId: EVENT_ID, title: 'Later' });

    expect(result).toEqual({ ok: false, error: 'eventNotFound' });
    expect(updateCalls.count).toBe(0);
  });

  it('refuses a soft-deleted event', async () => {
    selectRows.set(event, [{ ...eventRow, deletedAt: new Date('2026-09-01') }]);

    const result = await updateEvent(adultPrincipal, { eventId: EVENT_ID, title: 'Later' });

    expect(result).toEqual({ ok: false, error: 'eventNotFound' });
    expect(updateCalls.count).toBe(0);
  });

  it('keeps every omitted field at its existing value', async () => {
    const result = await updateEvent(adultPrincipal, { eventId: EVENT_ID, title: 'Zwembad' });

    expect(result).toEqual({ ok: true, eventId: EVENT_ID });
    expect(updateCalls.count).toBe(1);
    expect(updateCalls.lastSet).toMatchObject({
      title: 'Zwembad',
      description: eventRow.description,
      location: eventRow.location,
      startsAt: eventRow.startsAt,
      endsAt: eventRow.endsAt,
      allDay: eventRow.allDay,
      ownerMemberId: eventRow.ownerMemberId,
      attendeeMemberIds: eventRow.attendeeMemberIds,
      eventType: eventRow.eventType,
      calendarId: eventRow.calendarId,
      rrule: eventRow.rrule,
    });
  });

  it('refuses endsAt before startsAt', async () => {
    const result = await updateEvent(adultPrincipal, {
      eventId: EVENT_ID,
      startsAt: '2026-09-10T08:00:00.000Z',
      endsAt: '2026-09-10T07:00:00.000Z',
    });

    expect(result).toEqual({ ok: false, error: 'endBeforeStart' });
    expect(updateCalls.count).toBe(0);
  });

  it('refuses flipping allDay without supplying both startsAt and endsAt', async () => {
    // `existing.startsAt`/`endsAt` are stored to match `existing.allDay` — a
    // timed instant, or a UTC midnight. Carrying either forward under the
    // *other* meaning would break that invariant, so the combination is
    // refused rather than silently writing a bad row.
    const missingBoth = await updateEvent(adultPrincipal, { eventId: EVENT_ID, allDay: true });
    expect(missingBoth).toEqual({ ok: false, error: 'invalidInput' });

    const missingEnd = await updateEvent(adultPrincipal, {
      eventId: EVENT_ID,
      allDay: true,
      startsAt: '2026-09-10T00:00:00.000Z',
    });
    expect(missingEnd).toEqual({ ok: false, error: 'invalidInput' });

    const missingStart = await updateEvent(adultPrincipal, {
      eventId: EVENT_ID,
      allDay: true,
      endsAt: '2026-09-10T00:00:00.000Z',
    });
    expect(missingStart).toEqual({ ok: false, error: 'invalidInput' });

    expect(updateCalls.count).toBe(0);
  });

  it('allows flipping allDay when both startsAt and endsAt are supplied', async () => {
    const result = await updateEvent(adultPrincipal, {
      eventId: EVENT_ID,
      allDay: true,
      startsAt: '2026-09-10T00:00:00.000Z',
      endsAt: '2026-09-11T00:00:00.000Z',
    });

    expect(result).toEqual({ ok: true, eventId: EVENT_ID });
    expect(updateCalls.lastSet).toMatchObject({ allDay: true });
  });

  it('allows an unchanged allDay value with no dates supplied', async () => {
    const result = await updateEvent(adultPrincipal, { eventId: EVENT_ID, allDay: false });

    expect(result).toEqual({ ok: true, eventId: EVENT_ID });
    expect(updateCalls.count).toBe(1);
  });

  it('refuses a calendarId scoped to another family', async () => {
    selectRows.set(calendar, []);

    const result = await updateEvent(adultPrincipal, {
      eventId: EVENT_ID,
      calendarId: CALENDAR_ID,
    });

    expect(result).toEqual({ ok: false, error: 'calendarNotFound' });
    expect(updateCalls.count).toBe(0);
  });

  it('applies byweekday given alone, defaulting the preset to weekly', async () => {
    selectRows.set(event, [{ ...eventRow, rrule: 'FREQ=WEEKLY;BYDAY=TU,TH' }]);

    const result = await updateEvent(adultPrincipal, {
      eventId: EVENT_ID,
      byweekday: ['MO', 'TH'],
    });

    expect(result).toEqual({ ok: true, eventId: EVENT_ID });
    expect(updateCalls.lastSet).toMatchObject({ rrule: 'FREQ=WEEKLY;BYDAY=MO,TH' });
  });

  it('refuses byweekday paired with a non-weekly recurrence instead of silently dropping it', async () => {
    selectRows.set(event, [{ ...eventRow, rrule: 'FREQ=WEEKLY;BYDAY=TU,TH' }]);

    const result = await updateEvent(adultPrincipal, {
      eventId: EVENT_ID,
      recurrence: 'custom',
      byweekday: ['MO', 'TH'],
    });

    expect(result).toEqual({ ok: false, error: 'invalidInput' });
    expect(updateCalls.count).toBe(0);
  });

  it('publishes and pushes to Google on the happy path', async () => {
    const result = await updateEvent(adultPrincipal, { eventId: EVENT_ID, title: 'Zwembad' });

    expect(result).toEqual({ ok: true, eventId: EVENT_ID });
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

describe('deleteEvent', () => {
  it('refuses a principal without event:write', async () => {
    const result = await deleteEvent(childPrincipal, EVENT_ID);

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(updateCalls.count).toBe(0);
    expect(publish).not.toHaveBeenCalled();
    expect(pushToGoogle).not.toHaveBeenCalled();
  });

  it('refuses an event id that resolves to nothing — unknown, or a forged cross-family id', async () => {
    selectRows.set(event, []);

    const result = await deleteEvent(adultPrincipal, EVENT_ID);

    expect(result).toEqual({ ok: false, error: 'eventNotFound' });
    expect(updateCalls.count).toBe(0);
  });

  it('soft-deletes the row, publishing and pushing to Google', async () => {
    const result = await deleteEvent(adultPrincipal, EVENT_ID);

    expect(result).toEqual({ ok: true });
    expect(updateCalls.count).toBe(1);
    expect(updateCalls.lastSet).toMatchObject({ deletedAt: expect.any(Date) });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: FAMILY_ID,
        type: 'event.deleted',
        entity: { id: EVENT_ID },
      })
    );
    expect(pushToGoogle).toHaveBeenCalledWith(EVENT_ID);
  });
});
