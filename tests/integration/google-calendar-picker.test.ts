import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleCalendarListPage } from '@/modules/google/domain/types';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';
import { createFakeApi } from '../unit/google/support/fake-api';

/**
 * "Only what the household asked for."
 *
 * Linking a Google account used to switch on every calendar Google reported as
 * *selected*, which on a normal personal account is a holiday feed, a partner's
 * diary and a birthdays calendar — all of them on the family wall before anyone
 * had been asked. Worse on the way back: `removeCalendar` hard-deletes the row,
 * so a reconnect re-discovered a removed calendar as brand new and switched it
 * on again, every time.
 *
 * Three things have to hold, and this suite runs them against a real Postgres
 * because all three are decided by the same upsert:
 *
 *  1. a first link enables the primary calendar and nothing else;
 *  2. a relink enables *nothing* — the primary included;
 *  3. a calendar the parent already decided about is never re-decided.
 *
 * Then the picker: one confirmation applying additions and removals together,
 * touching only the calendars whose state actually changes.
 */

const stubs = vi.hoisted(() => ({
  db: undefined as unknown as ReturnType<typeof createTestDb>['db'],
  session: null as { session: { activeFamilyId?: string; memberId?: string } } | null,
  listCalendars: [] as GoogleCalendarListPage[],
  enqueued: [] as string[],
  watched: [] as string[],
  stopped: [] as string[],
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
// Same stand-in as `google-calendar-toggle.test.ts`: the action graph reaches
// `@/i18n/navigation`, whose `createNavigation` pulls next-intl's *client*
// navigation and with it `next/navigation`, which does not resolve in a plain
// Node test.
vi.mock('@/i18n/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
  Link: () => null,
  usePathname: () => '/',
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
// The Google boundary, the only thing this suite fakes: discovery's calendar
// list, and the two channel calls the toggle makes on either edge.
vi.mock('@/modules/google/api', () => ({
  createGoogleCalendarApi: () => createFakeApi({ listCalendars: [...stubs.listCalendars] }),
}));
vi.mock('@/modules/google/channels', () => ({
  watchCalendar: async (row: { id: string }) => {
    stubs.watched.push(row.id);
    return null;
  },
  stopChannel: async (row: { id: string }) => {
    stubs.stopped.push(row.id);
  },
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

const { discoverCalendars } = await import('@/modules/google/sync');
const { applyCalendarSelectionAction } = await import('@/modules/google/actions');

vi.setConfig({ testTimeout: 30_000 });

describe.skipIf(!databaseUrl)('calendar picker + discovery defaults (integration)', () => {
  const { pool, db } = createTestDb();

  let household: Household;
  let accountId: string;

  const page = (
    items: { id: string; summary: string; primary?: boolean; selected?: boolean }[]
  ): GoogleCalendarListPage => ({ items });

  beforeAll(async () => {
    stubs.db = db;
    household = await seedHousehold(db, 'CalendarPicker');

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
    accountId = account.id;
  });

  beforeEach(async () => {
    stubs.enqueued.length = 0;
    stubs.watched.length = 0;
    stubs.stopped.length = 0;
    stubs.listCalendars.length = 0;
    await db.delete(schema.calendar).where(eq(schema.calendar.googleAccountId, accountId));
  });

  afterAll(async () => {
    await db.delete(schema.family).where(eq(schema.family.id, household.familyId));
    await pool.end();
  });

  async function storedCalendars(): Promise<{ googleCalendarId: string; syncEnabled: boolean }[]> {
    return db
      .select({
        googleCalendarId: schema.calendar.googleCalendarId,
        syncEnabled: schema.calendar.syncEnabled,
      })
      .from(schema.calendar)
      .where(eq(schema.calendar.googleAccountId, accountId))
      .orderBy(asc(schema.calendar.googleCalendarId))
      .then((rows) =>
        rows.map((row) => ({
          googleCalendarId: row.googleCalendarId ?? '',
          syncEnabled: row.syncEnabled,
        }))
      );
  }

  const workAccount = () =>
    page([
      { id: 'sarah@example.test', summary: 'Sarah', primary: true },
      // Ticked in Sarah's own Google Calendar — which used to be enough to put
      // it on the family wall.
      { id: 'holidays@group.v.calendar.google.com', summary: 'Feestdagen', selected: true },
      { id: 'colleague@example.test', summary: 'Collega', selected: true },
    ]);

  it('enables only the primary calendar on a first link', async () => {
    stubs.listCalendars.push(workAccount());

    await discoverCalendars(accountId);

    expect(await storedCalendars()).toEqual([
      { googleCalendarId: 'colleague@example.test', syncEnabled: false },
      { googleCalendarId: 'holidays@group.v.calendar.google.com', syncEnabled: false },
      { googleCalendarId: 'sarah@example.test', syncEnabled: true },
    ]);
  });

  it('enables nothing on a relink — a removed calendar must not come back on', async () => {
    stubs.listCalendars.push(workAccount());

    await discoverCalendars(accountId, { newCalendarDefault: 'none' });

    expect((await storedCalendars()).every((row) => !row.syncEnabled)).toBe(true);
  });

  it('never re-decides a calendar the parent already answered for', async () => {
    stubs.listCalendars.push(workAccount());
    await discoverCalendars(accountId);

    // The parent's own choices: primary off, a colleague's diary on.
    await db
      .update(schema.calendar)
      .set({ syncEnabled: false })
      .where(eq(schema.calendar.googleCalendarId, 'sarah@example.test'));
    await db
      .update(schema.calendar)
      .set({ syncEnabled: true })
      .where(eq(schema.calendar.googleCalendarId, 'colleague@example.test'));

    stubs.listCalendars.push(workAccount());
    await discoverCalendars(accountId);

    expect(await storedCalendars()).toEqual([
      { googleCalendarId: 'colleague@example.test', syncEnabled: true },
      { googleCalendarId: 'holidays@group.v.calendar.google.com', syncEnabled: false },
      { googleCalendarId: 'sarah@example.test', syncEnabled: false },
    ]);
  });

  async function seedDiscovered(): Promise<Map<string, string>> {
    stubs.listCalendars.push(workAccount());
    await discoverCalendars(accountId);
    stubs.enqueued.length = 0;
    stubs.watched.length = 0;

    const rows = await db
      .select({ id: schema.calendar.id, googleCalendarId: schema.calendar.googleCalendarId })
      .from(schema.calendar)
      .where(eq(schema.calendar.googleAccountId, accountId));

    return new Map(rows.map((row) => [row.googleCalendarId ?? '', row.id]));
  }

  const apply = (calendarIds: string[]) => {
    const form = new FormData();
    form.set('accountId', accountId);
    form.set('calendarIds', calendarIds.join(','));
    return applyCalendarSelectionAction({ status: 'idle' }, form);
  };

  it('applies the picker’s selection: additions on, everything unticked off', async () => {
    const ids = await seedDiscovered();

    expect(await apply([ids.get('colleague@example.test')!])).toEqual({ status: 'idle' });

    expect(await storedCalendars()).toEqual([
      { googleCalendarId: 'colleague@example.test', syncEnabled: true },
      { googleCalendarId: 'holidays@group.v.calendar.google.com', syncEnabled: false },
      // Unticked, so switched back off — the primary is not privileged once a
      // parent has actually answered the question.
      { googleCalendarId: 'sarah@example.test', syncEnabled: false },
    ]);

    // Enabling watches and queues a first sync; disabling stops the channel.
    expect(stubs.watched).toEqual([ids.get('colleague@example.test')]);
    expect(stubs.enqueued).toEqual([ids.get('colleague@example.test')]);
    expect(stubs.stopped).toEqual([ids.get('sarah@example.test')]);
  });

  it('touches nothing when the selection matches what is already stored', async () => {
    const ids = await seedDiscovered();

    // Exactly the state discovery left behind: the primary, and only it.
    expect(await apply([ids.get('sarah@example.test')!])).toEqual({ status: 'idle' });

    // No cursor clear, no re-sync, no channel churn for a confirmation that
    // changed nothing.
    expect(stubs.watched).toEqual([]);
    expect(stubs.enqueued).toEqual([]);
    expect(stubs.stopped).toEqual([]);
  });

  it('refuses an account id from another household', async () => {
    await seedDiscovered();

    const form = new FormData();
    form.set('accountId', randomUUID());
    form.set('calendarIds', '');

    expect(await applyCalendarSelectionAction({ status: 'idle' }, form)).toEqual({
      status: 'error',
      error: 'accountNotFound',
    });
  });
});
