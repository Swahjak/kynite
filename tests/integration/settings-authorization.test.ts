import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { DEVICE_SESSION_COOKIE, deviceSessionExpiry, hashDeviceToken } from '@/lib/device-session';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * M16's criterion: **owner-only sections (member roles, family deletion) are
 * denied to `adult` principals** — and the other half of the same decision,
 * that the *display* sections are not.
 *
 * `tests/unit/permissions.test.ts` proves the matrix cells and
 * `tests/unit/server-action-authorization.test.ts` proves every action calls
 * the chokepoint. Neither proves that a running action, resolving a real
 * principal from a real database, refuses — and refuses *without writing*.
 * Same shape as `device-authorization.test.ts`, and for the same reason: every
 * denial below is asserted twice, as the action's own refusal and as the
 * absence of the row it would have written. A refusal that still writes is the
 * failure this suite exists for.
 *
 * The family-deletion cases are the ones that would hurt most if wrong, so
 * they are run against a *disposable* household of their own: a bug that
 * deletes when it should refuse must not take the rest of the suite's fixtures
 * with it.
 */

const stubs = vi.hoisted(() => ({
  db: undefined as unknown as ReturnType<typeof createTestDb>['db'],
  session: null as { session: { activeFamilyId?: string; memberId?: string } } | null,
  signedOut: 0,
  cookies: new Map<string, string>(),
}));

vi.mock('@/server/db', () => ({ getDb: () => stubs.db }));
vi.mock('@/server/auth', () => ({
  getAuth: () => ({
    api: {
      getSession: async () => stubs.session,
      signOut: async () => {
        stubs.signedOut += 1;
      },
    },
  }),
}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (name: string) =>
      stubs.cookies.has(name) ? { name, value: stubs.cookies.get(name)! } : undefined,
    set: (name: string, value: string) => stubs.cookies.set(name, value),
    delete: (name: string) => stubs.cookies.delete(name),
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'nl' }));
vi.mock('@/i18n/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));

process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
process.env.TOKEN_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');

const { deleteFamilyAction, setHubDisplayAction, updateFamilyAction, updateMemberAction } =
  await import('@/modules/family/actions');
const { setCalendarDisplayAction } = await import('@/modules/calendar/actions');

vi.setConfig({ testTimeout: 30_000 });

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const familyInput = {
  name: 'Nieuwe naam',
  locale: 'en',
  timezone: 'America/New_York',
  weekStartsOn: '7',
};

describe.skipIf(!databaseUrl)('settings authorization (integration)', () => {
  const { pool, db } = createTestDb();
  const { family, member } = schema;

  let household: Household;
  let adultId: string;

  beforeAll(async () => {
    stubs.db = db;
    household = await seedHousehold(db, 'Settings');

    const [adult] = await db
      .insert(member)
      .values({
        familyId: household.familyId,
        displayName: 'Mark',
        role: 'adult',
        color: 'blue',
        sortOrder: 3,
      })
      .returning({ id: member.id });
    adultId = adult.id;
  });

  afterAll(async () => {
    await db.delete(family).where(eq(family.id, household.familyId));
    await pool.end();
  });

  beforeEach(() => {
    stubs.session = null;
    stubs.signedOut = 0;
    stubs.cookies = new Map();
  });

  function signInAs(familyId: string, memberId: string) {
    stubs.session = { session: { activeFamilyId: familyId, memberId } };
  }

  /** Pairs a real device row and points the cookie mock at its session. */
  async function signInAsDevice(familyId: string): Promise<string> {
    const [row] = await db
      .insert(schema.device)
      .values({ familyId, name: 'Keuken', kind: 'hub' })
      .returning();

    const token = `token-${row.id}`;
    await db.insert(schema.deviceSession).values({
      deviceId: row.id,
      tokenHash: hashDeviceToken(token),
      expiresAt: deviceSessionExpiry(new Date()),
    });

    stubs.session = null;
    stubs.cookies = new Map([[DEVICE_SESSION_COOKIE, token]]);
    return row.id;
  }

  function row(familyId: string) {
    return db
      .select()
      .from(family)
      .where(eq(family.id, familyId))
      .then((rows) => rows[0]);
  }

  describe('household settings (family:manage — owner only)', () => {
    it('lets the owner change name, language, zone and week start', async () => {
      signInAs(household.familyId, household.parentId);

      const result = await updateFamilyAction({ status: 'idle' }, form(familyInput));

      expect(result).toEqual({ status: 'idle' });
      const after = await row(household.familyId);
      expect(after).toMatchObject({
        name: 'Nieuwe naam',
        locale: 'en',
        timezone: 'America/New_York',
        weekStartsOn: 7,
      });
    });

    it('denies an adult — and writes nothing', async () => {
      signInAs(household.familyId, adultId);
      const before = await row(household.familyId);

      const result = await updateFamilyAction(
        { status: 'idle' },
        form({ ...familyInput, name: 'Overgenomen' })
      );

      expect(result).toEqual({ status: 'error', error: 'forbidden' });
      expect(await row(household.familyId)).toMatchObject({
        name: before.name,
        locale: before.locale,
        timezone: before.timezone,
      });
    });

    it('denies a child and a caller with no session at all', async () => {
      const before = await row(household.familyId);

      signInAs(household.familyId, household.childId);
      expect(await updateFamilyAction({ status: 'idle' }, form(familyInput))).toEqual({
        status: 'error',
        error: 'forbidden',
      });

      stubs.session = null;
      expect(await updateFamilyAction({ status: 'idle' }, form(familyInput))).toEqual({
        status: 'error',
        error: 'forbidden',
      });

      expect(await row(household.familyId)).toMatchObject({ name: before.name });
    });

    it('refuses a timezone the platform does not know, before writing anything', async () => {
      signInAs(household.familyId, household.parentId);
      const before = await row(household.familyId);

      const result = await updateFamilyAction(
        { status: 'idle' },
        form({ ...familyInput, timezone: 'Mars/Olympus_Mons' })
      );

      expect(result).toEqual({ status: 'error', error: 'invalidInput' });
      expect(await row(household.familyId)).toMatchObject({ timezone: before.timezone });
    });
  });

  describe('member roles (member:manage — owner only)', () => {
    it('denies an adult promoting a child to adult', async () => {
      signInAs(household.familyId, adultId);

      const result = await updateMemberAction(
        { status: 'idle' },
        form({
          memberId: household.childId,
          displayName: 'Bram',
          role: 'adult',
          color: 'orange',
          rewardHorizon: 'instant',
        })
      );

      expect(result).toEqual({ status: 'error', error: 'forbidden' });

      const [subject] = await db.select().from(member).where(eq(member.id, household.childId));
      expect(subject.role, 'the role may not have moved').toBe('child');
    });
  });

  describe('hub display (display:manage — both parents)', () => {
    it('lets an adult change the hub default view', async () => {
      signInAs(household.familyId, adultId);

      const result = await setHubDisplayAction(
        { status: 'idle' },
        form({ hubDefaultView: 'agenda' })
      );

      expect(result).toEqual({ status: 'idle' });
      expect(await row(household.familyId)).toMatchObject({ hubDefaultView: 'agenda' });
    });

    it('denies a child', async () => {
      signInAs(household.familyId, household.childId);

      const result = await setHubDisplayAction({ status: 'idle' }, form({ hubDefaultView: 'day' }));

      expect(result).toEqual({ status: 'error', error: 'forbidden' });
      expect(await row(household.familyId)).toMatchObject({ hubDefaultView: 'agenda' });
    });
  });

  describe('calendar display (display:manage, scoped to the calling family)', () => {
    /** A minimal Google account + calendar pair, owned by the given family. */
    async function seedCalendarFor(familyId: string, ownerMemberId: string): Promise<string> {
      const suffix = randomUUID();
      const [account] = await db
        .insert(schema.googleAccount)
        .values({
          familyId,
          ownerMemberId,
          googleUserId: `nb5-${suffix}`,
          email: `nb5-${suffix}@example.test`,
        })
        .returning({ id: schema.googleAccount.id });

      const [row] = await db
        .insert(schema.calendar)
        .values({
          familyId,
          googleAccountId: account.id,
          googleCalendarId: `nb5-${suffix}`,
          summary: 'Werk',
        })
        .returning({ id: schema.calendar.id });

      return row.id;
    }

    async function calendarDisplayRow(calendarId: string) {
      return db
        .select()
        .from(schema.calendarDisplay)
        .where(eq(schema.calendarDisplay.calendarId, calendarId))
        .then((rows) => rows[0]);
    }

    it('refuses a forged cross-family calendarId — calendarNotFound, nothing written', async () => {
      const other = await seedHousehold(db, 'NB5-Foreign');
      const foreignCalendarId = await seedCalendarFor(other.familyId, other.parentId);

      signInAs(household.familyId, household.parentId);

      const result = await setCalendarDisplayAction(
        { status: 'idle' },
        form({ calendarId: foreignCalendarId, category: 'purple', visibility: 'family' })
      );

      expect(result).toEqual({ status: 'error', error: 'calendarNotFound' });
      expect(await calendarDisplayRow(foreignCalendarId)).toBeUndefined();

      await db.delete(family).where(eq(family.id, other.familyId));
    });

    it('denies a child — and writes nothing', async () => {
      const calendarId = await seedCalendarFor(household.familyId, household.parentId);
      signInAs(household.familyId, household.childId);

      const result = await setCalendarDisplayAction(
        { status: 'idle' },
        form({ calendarId, category: 'purple', visibility: 'family' })
      );

      expect(result).toEqual({ status: 'error', error: 'forbidden' });
      expect(await calendarDisplayRow(calendarId)).toBeUndefined();
    });

    it('denies a device principal — and writes nothing', async () => {
      const calendarId = await seedCalendarFor(household.familyId, household.parentId);
      await signInAsDevice(household.familyId);

      const result = await setCalendarDisplayAction(
        { status: 'idle' },
        form({ calendarId, category: 'purple', visibility: 'family' })
      );

      expect(result).toEqual({ status: 'error', error: 'forbidden' });
      expect(await calendarDisplayRow(calendarId)).toBeUndefined();
    });
  });

  describe('family deletion (family:manage — owner only)', () => {
    /** A household nobody else's assertions depend on. */
    async function disposable(): Promise<Household> {
      return seedHousehold(db, 'Disposable');
    }

    const survives = async (familyId: string) =>
      db
        .select()
        .from(family)
        .where(eq(family.id, familyId))
        .then((rows) => rows.length === 1);

    it('denies an adult — the household is still there afterwards', async () => {
      const victim = await disposable();
      const [adult] = await db
        .insert(member)
        .values({
          familyId: victim.familyId,
          displayName: 'Mark',
          role: 'adult',
          color: 'blue',
          sortOrder: 3,
        })
        .returning({ id: member.id });

      signInAs(victim.familyId, adult.id);
      const name = (await row(victim.familyId)).name;

      const result = await deleteFamilyAction({ status: 'idle' }, form({ confirmName: name }));

      expect(result).toEqual({ status: 'error', error: 'forbidden' });
      expect(await survives(victim.familyId), 'nothing may be deleted').toBe(true);
      expect(stubs.signedOut, 'a refused caller is not signed out').toBe(0);

      await db.delete(family).where(eq(family.id, victim.familyId));
    });

    it('refuses the owner too when the typed name does not match', async () => {
      const victim = await disposable();
      signInAs(victim.familyId, victim.parentId);

      const result = await deleteFamilyAction(
        { status: 'idle' },
        form({ confirmName: 'iets anders' })
      );

      expect(result).toEqual({ status: 'error', error: 'confirmationMismatch' });
      expect(await survives(victim.familyId)).toBe(true);

      await db.delete(family).where(eq(family.id, victim.familyId));
    });

    it('deletes for the owner who confirms, and takes the members with it', async () => {
      const victim = await disposable();
      signInAs(victim.familyId, victim.parentId);
      const name = (await row(victim.familyId)).name;

      // The action ends in a redirect, which throws — the same shape every
      // redirecting action in this repo is asserted with.
      await expect(
        deleteFamilyAction({ status: 'idle' }, form({ confirmName: name }))
      ).rejects.toThrow('NEXT_REDIRECT');

      expect(await survives(victim.familyId)).toBe(false);
      const orphans = await db.select().from(member).where(eq(member.familyId, victim.familyId));
      expect(orphans, 'every row cascades off family.id').toHaveLength(0);
      expect(stubs.signedOut, 'the owner is signed out of a household that is gone').toBe(1);
    });
  });
});
