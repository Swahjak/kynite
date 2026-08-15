import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleCalendarListPage, GoogleCalendarResource } from '@/modules/google/domain/types';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';
import { createFakeApi } from '../unit/google/support/fake-api';

/**
 * "Only the household's own calendars, and only the ones it asked for."
 *
 * Linking a Google account used to switch on every calendar Google reported as
 * *selected*, which on a normal personal account is a holiday feed, a partner's
 * diary and a birthdays calendar — all of them on the family wall before anyone
 * had been asked. Worse on the way back: `removeCalendar` hard-deletes the row,
 * so a reconnect re-discovered a removed calendar as brand new and switched it
 * on again, every time.
 *
 * Two separate questions, in order. **May this calendar exist here at all?** —
 * answered only by ownership: Kynite stores calendars the account holder owns
 * and nothing else, so a colleague's diary, a meeting room and a subscribed
 * feed are never rows, and a row that stops qualifying is pruned on the next
 * pass. **Then, of the household's own calendars, which sync?** — a first link
 * enables the primary and nothing else, a relink enables nothing, and a
 * calendar the parent already decided about is never re-decided.
 *
 * All of it runs against a real Postgres because one upsert (and one delete)
 * decides the lot. Then the picker: one confirmation applying additions and
 * removals together, touching only the calendars whose state actually changes.
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
    items: {
      id: string;
      summary: string;
      primary?: boolean;
      selected?: boolean;
      accessRole?: GoogleCalendarResource['accessRole'];
    }[]
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

  /**
   * Sarah's own calendars: her primary, plus two she created herself. Google
   * grades all three `owner`, which is exactly what makes them the family's to
   * hold.
   */
  const ownCalendars = () =>
    page([
      { id: 'sarah@example.test', summary: 'Sarah', primary: true, accessRole: 'owner' },
      { id: 'werk@example.test', summary: 'Werk', accessRole: 'owner' },
      { id: 'sport@example.test', summary: 'Sport', accessRole: 'owner' },
    ]);

  /** The same account as her employer sees it: three calendars that are not hers. */
  const workAccount = () =>
    page([
      { id: 'sarah@example.test', summary: 'Sarah', primary: true, accessRole: 'owner' },
      // Ticked in Sarah's own Google Calendar — which used to be enough to put
      // it on the family wall.
      {
        id: 'holidays@group.v.calendar.google.com',
        summary: 'Feestdagen',
        selected: true,
        accessRole: 'reader',
      },
      { id: 'jeroen@example.test', summary: 'Jeroen', selected: true, accessRole: 'writer' },
      {
        id: 'room-3@resource.calendar.google.com',
        summary: 'Vergaderzaal 3',
        accessRole: 'reader',
      },
    ]);

  it('stores only the calendars the account holder owns', async () => {
    stubs.listCalendars.push(workAccount());

    await discoverCalendars(accountId);

    // A colleague's diary, a subscribed feed and a meeting room are not rows at
    // all — not rows that are switched off. There is nothing to pick, nothing
    // to enable and nothing to sync.
    expect(await storedCalendars()).toEqual([
      { googleCalendarId: 'sarah@example.test', syncEnabled: true },
    ]);
  });

  it('enables only the primary calendar on a first link', async () => {
    stubs.listCalendars.push(ownCalendars());

    await discoverCalendars(accountId);

    expect(await storedCalendars()).toEqual([
      { googleCalendarId: 'sarah@example.test', syncEnabled: true },
      { googleCalendarId: 'sport@example.test', syncEnabled: false },
      { googleCalendarId: 'werk@example.test', syncEnabled: false },
    ]);
  });

  it('enables nothing on a relink — a removed calendar must not come back on', async () => {
    stubs.listCalendars.push(ownCalendars());

    await discoverCalendars(accountId, { newCalendarDefault: 'none' });

    expect((await storedCalendars()).every((row) => !row.syncEnabled)).toBe(true);
  });

  it('never re-decides a calendar the parent already answered for', async () => {
    stubs.listCalendars.push(ownCalendars());
    await discoverCalendars(accountId);

    // The parent's own choices: primary off, her work calendar on.
    await db
      .update(schema.calendar)
      .set({ syncEnabled: false })
      .where(eq(schema.calendar.googleCalendarId, 'sarah@example.test'));
    await db
      .update(schema.calendar)
      .set({ syncEnabled: true })
      .where(eq(schema.calendar.googleCalendarId, 'werk@example.test'));

    stubs.listCalendars.push(ownCalendars());
    await discoverCalendars(accountId);

    expect(await storedCalendars()).toEqual([
      { googleCalendarId: 'sarah@example.test', syncEnabled: false },
      { googleCalendarId: 'sport@example.test', syncEnabled: false },
      { googleCalendarId: 'werk@example.test', syncEnabled: true },
    ]);
  });

  it('prunes a calendar stored before the owner-only rule, channel and all', async () => {
    // The state a household is actually in today: a colleague's diary and a
    // meeting room, discovered and synced under the old rule, both with a live
    // push channel.
    stubs.listCalendars.push(ownCalendars());
    await discoverCalendars(accountId);

    const [stale] = await db
      .insert(schema.calendar)
      .values({
        familyId: household.familyId,
        googleAccountId: accountId,
        googleCalendarId: 'jeroen@example.test',
        summary: 'Jeroen',
        writable: true,
        syncEnabled: true,
        syncToken: 'token-from-a-previous-life',
        channelId: 'channel-jeroen',
        channelResourceId: 'resource-jeroen',
      })
      .returning();

    // Sarah's own choice, which the prune must leave alone.
    await db
      .update(schema.calendar)
      .set({ syncEnabled: true })
      .where(eq(schema.calendar.googleCalendarId, 'werk@example.test'));

    stubs.listCalendars.push(ownCalendars());
    await discoverCalendars(accountId);

    expect(await storedCalendars()).toEqual([
      { googleCalendarId: 'sarah@example.test', syncEnabled: true },
      { googleCalendarId: 'sport@example.test', syncEnabled: false },
      { googleCalendarId: 'werk@example.test', syncEnabled: true },
    ]);
    // Removed the way settings removes one: Google stops notifying us first.
    expect(stubs.stopped).toEqual([stale.id]);
  });

  it('prunes a calendar Google no longer returns at all', async () => {
    stubs.listCalendars.push(ownCalendars());
    await discoverCalendars(accountId);

    // Sarah deleted "Sport" in Google. It is not in the list any more — not
    // listed as `deleted`, simply absent — which is the ordinary way a calendar
    // leaves an account, and it must not linger here syncing nothing.
    //
    // The fake api copies the queue at construction, so each discovery pass
    // reads from the head of it — a *replacement* list, not an appended page.
    stubs.listCalendars.length = 0;
    stubs.listCalendars.push(
      page([
        { id: 'sarah@example.test', summary: 'Sarah', primary: true, accessRole: 'owner' },
        { id: 'werk@example.test', summary: 'Werk', accessRole: 'owner' },
      ])
    );
    await discoverCalendars(accountId);

    expect(await storedCalendars()).toEqual([
      { googleCalendarId: 'sarah@example.test', syncEnabled: true },
      { googleCalendarId: 'werk@example.test', syncEnabled: false },
    ]);
  });

  it('leaves the household’s own native calendar alone', async () => {
    const [native] = await db
      .insert(schema.calendar)
      .values({
        familyId: household.familyId,
        summary: 'Gezin',
        isHousehold: true,
        syncEnabled: false,
      })
      .returning();

    stubs.listCalendars.push(ownCalendars());
    await discoverCalendars(accountId);

    const [row] = await db.select().from(schema.calendar).where(eq(schema.calendar.id, native.id));
    expect(row).toBeDefined();

    await db.delete(schema.calendar).where(eq(schema.calendar.id, native.id));
  });

  async function seedDiscovered(): Promise<Map<string, string>> {
    stubs.listCalendars.push(ownCalendars());
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

    expect(await apply([ids.get('werk@example.test')!])).toEqual({ status: 'idle' });

    expect(await storedCalendars()).toEqual([
      // Unticked, so switched back off — the primary is not privileged once a
      // parent has actually answered the question.
      { googleCalendarId: 'sarah@example.test', syncEnabled: false },
      { googleCalendarId: 'sport@example.test', syncEnabled: false },
      { googleCalendarId: 'werk@example.test', syncEnabled: true },
    ]);

    // Enabling watches and queues a first sync; disabling stops the channel.
    expect(stubs.watched).toEqual([ids.get('werk@example.test')]);
    expect(stubs.enqueued).toEqual([ids.get('werk@example.test')]);
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
