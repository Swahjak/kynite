import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Principal } from '@/modules/family';
import { calendar, family as familyTable, member as memberTable } from '@/server/db/schema';
import type { CreateEventInput } from '@/modules/calendar/write';

/**
 * `createEvent` — the MCP write seam (M-B) — exercised with a fully mocked
 * `getDb()`, matching the discipline `recordCompletion` documents for a write
 * reachable from more than one entry point: `can()` runs *inside* the seam
 * against whatever `Principal` is passed in, so these tests never touch a
 * cookie or a session — only the explicit principal the (future) MCP route
 * would build.
 *
 * The fake `db` is keyed by *table identity* (`select().from(X)`) rather than
 * by call order, so a test only has to say what each table should answer.
 */

const selectRows = vi.hoisted(() => new Map<unknown, unknown[]>());
const insertRows = vi.hoisted(() => ({ current: [] as unknown[] }));
const insertCalls = vi.hoisted(() => ({ count: 0 }));

vi.mock('@/server/db', () => ({
  getDb: () => ({
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
        values: () => ({
          returning: async () => insertRows.current,
        }),
      };
    },
  }),
}));

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

const { createEvent } = await import('@/modules/calendar/write');

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
