import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';
import { createFakeApi, type FakeApi } from '../unit/google/support/fake-api';
import { googleEvent } from '../unit/google/support/fixtures';

/**
 * B1/B2/N6: the shared push-and-retry wrapper (`@/modules/google`'s
 * `pushEventWithRetry`, aliased as `pushToGoogle` by
 * `@/modules/calendar/sync-bridge` and called directly by the
 * `google:push-event` job worker — `src/modules/google/jobs.ts`) against a
 * real Postgres, with the Google Calendar API boundary replaced by the
 * existing `createFakeApi` fake (docs/architecture.md §9: mock the boundary,
 * not our own modules — failure is injected as a real thrown `Error` from the
 * fake, never a mock of `pushToGoogle`/`pushEventById` themselves).
 *
 * `createGoogleCalendarApi` is the seam: `apiForAccount` (`sync.ts`) calls it
 * fresh per push, so mocking `@/modules/google/api`'s export swaps in the fake
 * without touching anything else in the sync/push modules — same technique as
 * `google-channels.test.ts`'s `apiForAccount` mock, one layer further down
 * (mocking `sync.ts` itself would not work here: `pushEventById`'s internal
 * call to `apiForAccount` is a same-module reference that a `vi.mock` on
 * `sync.ts` cannot intercept, only cross-module ones).
 */

let currentApi: FakeApi;

vi.mock('@/modules/google/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/google/api')>();
  return {
    ...actual,
    createGoogleCalendarApi: () => currentApi,
  };
});

describe.skipIf(!databaseUrl)('google push retry (integration)', () => {
  const { pool, db } = createTestDb();

  let household: Household;
  let accountId: string;
  let calendarId: string;
  let push: typeof import('@/modules/google/push');

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
    process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
    process.env.GOOGLE_CLIENT_ID ??= 'client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET ??= 'client-secret';
    process.env.TOKEN_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');

    push = await import('@/modules/google/push');

    household = await seedHousehold(db, 'PushRetry');

    const [account] = await db
      .insert(schema.googleAccount)
      .values({
        familyId: household.familyId,
        ownerMemberId: household.parentId,
        googleUserId: `google-${randomUUID()}`,
        email: 'parent@example.test',
      })
      .returning();
    accountId = account.id;

    const [row] = await db
      .insert(schema.calendar)
      .values({
        familyId: household.familyId,
        googleAccountId: accountId,
        googleCalendarId: 'family@group.calendar.google.com',
        summary: 'Gezin',
        writable: true,
        syncEnabled: true,
      })
      .returning();
    calendarId = row.id;
  });

  afterAll(async () => {
    await db.delete(schema.family).where(eq(schema.family.id, household.familyId));
    await pool.end();
  });

  async function seedEvent(overrides: Partial<typeof schema.event.$inferInsert> = {}) {
    const [row] = await db
      .insert(schema.event)
      .values({
        familyId: household.familyId,
        calendarId,
        title: 'Tandarts',
        startsAt: new Date('2026-08-05T08:00:00Z'),
        endsAt: new Date('2026-08-05T09:00:00Z'),
        ...overrides,
      })
      .returning();
    return row;
  }

  async function pendingSyncAtFor(eventId: string): Promise<Date | null> {
    const [row] = await db
      .select({ pendingSyncAt: schema.event.pendingSyncAt })
      .from(schema.event)
      .where(eq(schema.event.id, eventId));
    return row.pendingSyncAt;
  }

  it('B2(a): a failed push sets pendingSyncAt', async () => {
    const row = await seedEvent();
    // A real thrown error from the API boundary — not a mock of pushToGoogle.
    currentApi = createFakeApi({ insertEvent: [new Error('network down')] });

    await push.pushEventWithRetry(row.id);

    expect(await pendingSyncAtFor(row.id)).not.toBeNull();
  });

  it('B1/B2(b): a subsequent successful push — via the same wrapper the job worker calls — clears pendingSyncAt', async () => {
    const row = await seedEvent();

    // First attempt fails, matching a real Google outage.
    currentApi = createFakeApi({ insertEvent: [new Error('network down')] });
    await push.pushEventWithRetry(row.id);
    expect(await pendingSyncAtFor(row.id)).not.toBeNull();

    // The retry succeeds — via `patchEvent`, not `insertEvent`: the push
    // engine claims the row's `googleEventId` *before* the network call
    // (`domain/push-engine.ts`'s idempotence invariant), and that claim
    // already landed on the first, failed attempt. So the row now has a
    // `googleEventId` and the retry is a `pushUpdate`, exactly as it would be
    // for any real retry after a partial failure.
    currentApi = createFakeApi({ patchEvent: [googleEvent({ id: 'evt-retry' })] });
    // This call is exactly what `registerGoogleJobs`'s `google:push-event`
    // worker makes (B1: it calls `pushEventWithRetry`, the same wrapper as
    // the Server Actions, not `pushEventById` directly) — proving it clears
    // the pip here is what proves a retry that lands is no longer permanent.
    await push.pushEventWithRetry(row.id);

    expect(await pendingSyncAtFor(row.id)).toBeNull();
  });

  it('N6: a skip (read-only calendar) also clears pendingSyncAt — no push was ever expected', async () => {
    const [readOnlyCalendar] = await db
      .insert(schema.calendar)
      .values({
        familyId: household.familyId,
        googleAccountId: accountId,
        googleCalendarId: `readonly-${randomUUID()}@group.calendar.google.com`,
        summary: 'Werk',
        writable: false,
        syncEnabled: true,
      })
      .returning();

    const row = await seedEvent({ calendarId: readOnlyCalendar.id, pendingSyncAt: new Date() });
    // No API call should even be attempted for an unsyncable calendar.
    currentApi = createFakeApi({});

    await push.pushEventWithRetry(row.id);

    expect(await pendingSyncAtFor(row.id)).toBeNull();
    expect(currentApi.calls.insertEvent).toHaveLength(0);
  });

  it('N6: a native event (no calendar) is a skip too, and clears pendingSyncAt', async () => {
    const row = await seedEvent({
      calendarId: null,
      eventType: 'reward',
      pendingSyncAt: new Date(),
    });
    currentApi = createFakeApi({});

    await push.pushEventWithRetry(row.id);

    expect(await pendingSyncAtFor(row.id)).toBeNull();
    expect(currentApi.calls.insertEvent).toHaveLength(0);
  });
});
