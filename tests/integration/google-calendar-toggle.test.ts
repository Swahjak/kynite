import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * M18, user-reported: **switching a calendar off has to empty it.**
 *
 * `syncEnabled` governed only the ingest side — the poll skipped the calendar
 * and its channel stopped — while every event it had already imported stayed on
 * the board. A parent who muted a colleague's shared diary in settings watched
 * it keep rendering on the wall and reasonably concluded the switch did
 * nothing.
 *
 * Three things have to hold, and the third is the one a naive fix misses: the
 * events go, *native* events stay (they have no calendar row and belong to
 * nobody's Google account), and the sync cursor is cleared in the same commit
 * so switching back on is a full pass rather than an incremental one that would
 * ask Google only for what had changed and restore nothing.
 */

const stubs = vi.hoisted(() => ({
  db: undefined as unknown as ReturnType<typeof createTestDb>['db'],
  session: null as { session: { activeFamilyId?: string; memberId?: string } } | null,
  enqueued: [] as string[],
}));

vi.mock('@/server/db', () => ({ getDb: () => stubs.db }));
vi.mock('@/server/auth', () => ({
  getAuth: () => ({ api: { getSession: async () => stubs.session } }),
}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'nl' }));
vi.mock('@/i18n/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
  Link: () => null,
  usePathname: () => '/',
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
// The channel calls reach Google; the toggle's contract is what it does to the
// database, so the network half is stubbed at the module that owns it.
vi.mock('@/modules/google/channels', () => ({
  watchCalendar: async () => null,
  stopChannel: async () => {},
}));
vi.mock('@/modules/google/jobs', () => ({
  enqueueCalendarSync: async (calendarId: string) => {
    stubs.enqueued.push(calendarId);
    return randomUUID();
  },
}));

process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
process.env.TOKEN_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');

const { setCalendarSyncAction } = await import('@/modules/google/actions');

vi.setConfig({ testTimeout: 30_000 });

describe.skipIf(!databaseUrl)('calendar sync toggle (integration)', () => {
  const { pool, db } = createTestDb();

  let household: Household;
  let calendarId: string;

  beforeAll(async () => {
    stubs.db = db;
    household = await seedHousehold(db, 'CalendarToggle');

    const [user] = await db
      .insert(schema.user)
      .values({
        id: randomUUID(),
        name: 'Sarah',
        email: `sarah-${randomUUID()}@example.test`,
        emailVerified: true,
      })
      .returning();

    await db
      .update(schema.member)
      .set({ userId: user.id })
      .where(eq(schema.member.id, household.parentId));

    stubs.session = {
      session: { activeFamilyId: household.familyId, memberId: household.parentId },
    };

    const [account] = await db
      .insert(schema.googleAccount)
      .values({
        familyId: household.familyId,
        ownerMemberId: household.parentId,
        googleUserId: `google-${randomUUID()}`,
        email: 'sarah@example.test',
      })
      .returning();

    const [calendar] = await db
      .insert(schema.calendar)
      .values({
        familyId: household.familyId,
        googleAccountId: account.id,
        googleCalendarId: 'work@example.test',
        summary: 'Werk',
        syncEnabled: true,
        syncToken: 'token-before',
        syncedAt: new Date(),
      })
      .returning();
    calendarId = calendar.id;
  });

  beforeEach(async () => {
    stubs.enqueued.length = 0;
    await db.delete(schema.event).where(eq(schema.event.familyId, household.familyId));
    await db
      .update(schema.calendar)
      .set({ syncEnabled: true, syncToken: 'token-before', syncedAt: new Date() })
      .where(eq(schema.calendar.id, calendarId));
  });

  afterAll(async () => {
    await db.delete(schema.family).where(eq(schema.family.id, household.familyId));
    await pool.end();
  });

  async function seedEvents(): Promise<void> {
    await db.insert(schema.event).values([
      {
        familyId: household.familyId,
        calendarId,
        googleEventId: 'from-google',
        title: 'Sprint review',
        startsAt: new Date('2026-08-07T09:00:00.000Z'),
        endsAt: new Date('2026-08-07T10:00:00.000Z'),
      },
      {
        familyId: household.familyId,
        // Null `calendarId` = a Kynite-native event. It has never been near a
        // Google account and must survive any calendar being switched off.
        calendarId: null,
        title: 'Zwemles Bram',
        startsAt: new Date('2026-08-07T15:00:00.000Z'),
        endsAt: new Date('2026-08-07T16:00:00.000Z'),
      },
      {
        familyId: household.familyId,
        // On the calendar, but never pushed: a parent created it in Kynite and
        // the push has not landed yet. Google has no copy, so re-enabling could
        // not bring it back — deleting it would destroy the only one.
        calendarId,
        googleEventId: null,
        title: 'Nog niet gepusht',
        startsAt: new Date('2026-08-07T18:00:00.000Z'),
        endsAt: new Date('2026-08-07T19:00:00.000Z'),
      },
    ]);
  }

  const toggle = (enabled: boolean) => {
    const form = new FormData();
    form.set('calendarId', calendarId);
    form.set('enabled', String(enabled));
    return setCalendarSyncAction({ status: 'idle' }, form);
  };

  it('deletes the calendar’s events when sync is switched off', async () => {
    await seedEvents();

    expect(await toggle(false)).toEqual({ status: 'idle' });

    const remaining = await db
      .select({ title: schema.event.title, calendarId: schema.event.calendarId })
      .from(schema.event)
      .where(eq(schema.event.familyId, household.familyId));

    expect(remaining.map((row) => row.title).sort()).toEqual(
      ['Nog niet gepusht', 'Zwemles Bram'].sort()
    );
  });

  it('keeps an un-pushed Kynite event on the calendar — Google has no copy of it', async () => {
    await seedEvents();
    await toggle(false);

    const survivors = await db
      .select({ title: schema.event.title })
      .from(schema.event)
      .where(
        and(eq(schema.event.familyId, household.familyId), isNull(schema.event.googleEventId))
      );

    expect(survivors.map((row) => row.title).sort()).toEqual(
      ['Nog niet gepusht', 'Zwemles Bram'].sort()
    );
  });

  it('clears the sync cursor in the same commit, so switching back on is a full pass', async () => {
    await seedEvents();
    await toggle(false);

    const [row] = await db
      .select({ syncEnabled: schema.calendar.syncEnabled, syncToken: schema.calendar.syncToken })
      .from(schema.calendar)
      .where(eq(schema.calendar.id, calendarId));

    expect(row.syncEnabled).toBe(false);
    // An incremental pass on a re-enabled calendar would ask Google only for
    // what had *changed*, and would restore nothing.
    expect(row.syncToken).toBeNull();
  });

  it('re-enabling enqueues a sync so the events come back', async () => {
    await seedEvents();
    await toggle(false);
    stubs.enqueued.length = 0;

    expect(await toggle(true)).toEqual({ status: 'idle' });
    expect(stubs.enqueued).toEqual([calendarId]);

    const [row] = await db
      .select({ syncEnabled: schema.calendar.syncEnabled })
      .from(schema.calendar)
      .where(eq(schema.calendar.id, calendarId));

    expect(row.syncEnabled).toBe(true);
  });

  it('clears a stale cursor on enable too, so the return trip is a full pass', async () => {
    // The race the disable alone cannot close: a sync pass already in flight
    // when the delete committed writes its cursor *afterwards*, leaving an empty
    // calendar with a live token. An incremental pass on that token would ask
    // Google only for what had changed since, and would restore nothing.
    await db
      .update(schema.calendar)
      .set({ syncEnabled: false, syncToken: 'token-from-a-racing-pass', syncedAt: new Date() })
      .where(eq(schema.calendar.id, calendarId));

    expect(await toggle(true)).toEqual({ status: 'idle' });

    const [row] = await db
      .select({
        syncEnabled: schema.calendar.syncEnabled,
        syncToken: schema.calendar.syncToken,
        syncedAt: schema.calendar.syncedAt,
      })
      .from(schema.calendar)
      .where(eq(schema.calendar.id, calendarId));

    expect(row.syncEnabled).toBe(true);
    expect(row.syncToken).toBeNull();
    expect(row.syncedAt).toBeNull();
    expect(stubs.enqueued).toEqual([calendarId]);
  });

  it('leaves native events alone even when every calendar is off', async () => {
    await seedEvents();
    await toggle(false);

    // Family-scoped, like every other read in this repo: the suites share one
    // database and a bare `calendar_id IS NULL` would count another household's
    // native events too.
    const native = await db
      .select({ id: schema.event.id })
      .from(schema.event)
      .where(and(eq(schema.event.familyId, household.familyId), isNull(schema.event.calendarId)));

    expect(native).toHaveLength(1);
  });
});
