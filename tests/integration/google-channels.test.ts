import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';
import { createFakeApi, type FakeApi } from '../unit/google/support/fake-api';

/**
 * N2 (review fix): `src/modules/google/channels.ts` is db-coupled directly
 * (no injectable `SyncStore`-style port, unlike the sync/push engines), so it
 * is exercised here against a real Postgres, with the Google Calendar API
 * boundary replaced by the existing `createFakeApi` watch/stopChannel fake
 * from `tests/unit/google/support/fake-api.ts` — the same fake the unit
 * suite drives the sync/push engines with (docs/architecture.md §9: mock the
 * boundary, not our own modules).
 *
 * `apiForAccount` is the seam: `channels.ts` calls it fresh per operation, so
 * mocking `@/modules/google/sync`'s export (both this file and `channels.ts`
 * resolve to the same module) swaps in the fake without touching anything
 * else in the sync module.
 */

let currentApi: FakeApi;

vi.mock('@/modules/google/sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/google/sync')>();
  return {
    ...actual,
    apiForAccount: () => currentApi,
  };
});

describe.skipIf(!databaseUrl)('google channels (integration)', () => {
  const { pool, db } = createTestDb();

  let household: Household;
  let accountId: string;
  let channels: typeof import('@/modules/google/channels');

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
    process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
    process.env.GOOGLE_CLIENT_ID ??= 'client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET ??= 'client-secret';
    process.env.TOKEN_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');

    channels = await import('@/modules/google/channels');

    household = await seedHousehold(db, 'GoogleChannels');

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
  });

  afterAll(async () => {
    await db.delete(schema.family).where(eq(schema.family.id, household.familyId));
    await pool.end();
  });

  afterEach(async () => {
    vi.clearAllMocks();
    // `renewExpiringChannels` sweeps *every* family's calendars by design (no
    // familyId in its query — it is a real cron over the whole table), so
    // rows this file leaves behind would otherwise leak into another
    // integration file's run. Scoped to this household only.
    await db.delete(schema.calendar).where(eq(schema.calendar.familyId, household.familyId));
  });

  async function insertCalendar(overrides: Partial<typeof schema.calendar.$inferInsert> = {}) {
    const [row] = await db
      .insert(schema.calendar)
      .values({
        familyId: household.familyId,
        googleAccountId: accountId,
        googleCalendarId: `cal-${randomUUID()}@group.calendar.google.com`,
        summary: 'Gezin',
        syncEnabled: true,
        ...overrides,
      })
      .returning();
    return row;
  }

  it('watchCalendar stores the new channelId, resourceId and expiration', async () => {
    const row = await insertCalendar();
    currentApi = createFakeApi({
      watch: [{ id: 'channel-1', resourceId: 'resource-1', expiration: '1999999999000' }],
    });

    const updated = await channels.watchCalendar(row);

    expect(updated).toMatchObject({ channelId: 'channel-1', channelResourceId: 'resource-1' });
    expect(updated!.channelExpiration).toEqual(new Date(1999999999000));
    expect(currentApi.calls.watch).toHaveLength(1);
    expect(currentApi.calls.watch[0]).toMatchObject({ calendarId: row.googleCalendarId });

    const [persisted] = await db
      .select()
      .from(schema.calendar)
      .where(eq(schema.calendar.id, row.id));
    expect(persisted.channelId).toBe('channel-1');
    expect(persisted.channelResourceId).toBe('resource-1');
  });

  it('re-watching stops the old channel before registering the new one', async () => {
    const row = await insertCalendar({
      channelId: 'channel-old',
      channelResourceId: 'resource-old',
      channelExpiration: new Date(Date.now() + 60_000),
    });
    currentApi = createFakeApi({
      watch: [{ id: 'channel-new', resourceId: 'resource-new', expiration: '1999999999000' }],
    });

    await channels.watchCalendar(row);

    expect(currentApi.calls.stopChannel).toEqual([
      { channelId: 'channel-old', resourceId: 'resource-old' },
    ]);
    expect(currentApi.calls.watch).toHaveLength(1);

    const [persisted] = await db
      .select()
      .from(schema.calendar)
      .where(eq(schema.calendar.id, row.id));
    expect(persisted.channelId).toBe('channel-new');
  });

  it('stopChannel clears channelId, resourceId and expiration', async () => {
    const row = await insertCalendar({
      channelId: 'channel-x',
      channelResourceId: 'resource-x',
      channelExpiration: new Date(Date.now() + 60_000),
    });
    currentApi = createFakeApi({});

    await channels.stopChannel(row);

    expect(currentApi.calls.stopChannel).toEqual([
      { channelId: 'channel-x', resourceId: 'resource-x' },
    ]);

    const [persisted] = await db
      .select()
      .from(schema.calendar)
      .where(eq(schema.calendar.id, row.id));
    expect(persisted.channelId).toBeNull();
    expect(persisted.channelResourceId).toBeNull();
    expect(persisted.channelExpiration).toBeNull();
  });

  describe('renewExpiringChannels', () => {
    // `renewExpiringChannels` runs an unscoped, whole-table sweep by design
    // (a real cron has no "family" to scope to) — so a concurrently-running
    // integration file that has left its own calendar rows behind (e.g.
    // `google-sync.test.ts`'s rows, which default to `channelId: null` and
    // therefore match the "never watched" branch) can add extra matches this
    // suite did not create. A generous, uniform scripted queue means those
    // extra calls still resolve instead of exhausting the queue and forcing
    // a spurious `failed` outcome; assertions below key off *this test's*
    // rows specifically rather than the aggregate counts.
    const NOISE_TOLERANT_WATCH_SCRIPT = Array.from({ length: 25 }, () => ({
      id: `renewed-${randomUUID()}`,
      resourceId: 'r',
      expiration: '1999999999000',
    }));

    it('renews a row expiring within the window, leaves a fresh row untouched', async () => {
      const now = new Date('2026-01-01T00:00:00Z');
      const expiringSoon = await insertCalendar({
        channelId: 'expiring',
        channelResourceId: 'resource-expiring',
        // Inside RENEWAL_WINDOW_MS (2h).
        channelExpiration: new Date(now.getTime() + 30 * 60 * 1000),
      });
      const fresh = await insertCalendar({
        channelId: 'fresh',
        channelResourceId: 'resource-fresh',
        // Outside the window.
        channelExpiration: new Date(now.getTime() + 6 * 60 * 60 * 1000),
      });
      currentApi = createFakeApi({ watch: [...NOISE_TOLERANT_WATCH_SCRIPT] });

      const result = await channels.renewExpiringChannels(now);

      expect(result.renewed).toBeGreaterThanOrEqual(1);
      expect(
        currentApi.calls.watch.some((call) => call.calendarId === expiringSoon.googleCalendarId)
      ).toBe(true);

      const [expiringRow] = await db
        .select()
        .from(schema.calendar)
        .where(eq(schema.calendar.id, expiringSoon.id));
      expect(expiringRow.channelId).not.toBe('expiring');

      const [freshRow] = await db
        .select()
        .from(schema.calendar)
        .where(eq(schema.calendar.id, fresh.id));
      expect(freshRow.channelId).toBe('fresh');
    });

    it('renews a row with a channelId but a NULL expiration — the edge case N2 fixes', async () => {
      // Before the fix, the OR-predicate required `channelExpiration IS NOT
      // NULL` on the "expiring" branch, so a row that somehow has a
      // channelId but no recorded expiration matched neither branch and was
      // never picked up by the renewal sweep — a silent, permanent gap.
      const now = new Date('2026-01-01T00:00:00Z');
      const orphaned = await insertCalendar({
        channelId: 'orphaned',
        channelResourceId: 'resource-orphaned',
        channelExpiration: null,
      });
      currentApi = createFakeApi({ watch: [...NOISE_TOLERANT_WATCH_SCRIPT] });

      const result = await channels.renewExpiringChannels(now);

      expect(result.renewed).toBeGreaterThanOrEqual(1);
      expect(
        currentApi.calls.watch.some((call) => call.calendarId === orphaned.googleCalendarId)
      ).toBe(true);

      const [row] = await db
        .select()
        .from(schema.calendar)
        .where(eq(schema.calendar.id, orphaned.id));
      expect(row.channelId).not.toBe('orphaned');
      expect(row.channelExpiration).not.toBeNull();
    });

    it('ignores a disabled calendar even with an expired channel', async () => {
      const now = new Date('2026-01-01T00:00:00Z');
      const disabled = await insertCalendar({
        syncEnabled: false,
        channelId: 'disabled',
        channelResourceId: 'resource-disabled',
        channelExpiration: new Date(now.getTime() - 1000),
      });
      currentApi = createFakeApi({ watch: [...NOISE_TOLERANT_WATCH_SCRIPT] });

      await channels.renewExpiringChannels(now);

      // Disabled calendars are excluded by the `syncEnabled` predicate
      // regardless of anything else in the table — checked at the row level
      // rather than via the aggregate call count, which cross-file noise can
      // otherwise inflate independent of this calendar.
      expect(
        currentApi.calls.watch.some((call) => call.calendarId === disabled.googleCalendarId)
      ).toBe(false);
      const [row] = await db
        .select()
        .from(schema.calendar)
        .where(eq(schema.calendar.id, disabled.id));
      expect(row.channelId).toBe('disabled');
    });
  });
});
