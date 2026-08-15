import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl } from './support/db';

/**
 * Social first run against a real Postgres (M19 phase 2).
 *
 * This file exists for the same reason `family-invite.test.ts` does: the
 * property under test is a *database* property. `createFamilyForSocialUserAction`
 * has to be safe against being run twice at once — a double click, a duplicated
 * tab, a retried POST — and the only thing that can answer whether two
 * concurrent callers can both create a household is a database that can
 * actually run them concurrently. A mocked one would agree with whatever the
 * code believes.
 *
 * Only the framework seams are faked (the session cookie, the locale, the two
 * redirects). The transaction, the advisory lock and every write are real.
 */

const stubs = vi.hoisted(() => ({
  db: undefined as unknown as ReturnType<typeof createTestDb>['db'],
  session: null as { session: Record<string, unknown>; user: Record<string, unknown> } | null,
  signOut: async () => {},
  signInSocial: async () => ({ url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' }),
}));

vi.mock('@/server/db', () => ({ getDb: () => stubs.db }));

vi.mock('@/server/auth', () => ({
  getAuth: () => ({
    api: {
      getSession: async () => stubs.session,
      signOut: async () => stubs.signOut(),
      signInSocial: async () => stubs.signInSocial(),
    },
  }),
  isSocialSignInConfigured: () => true,
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
}));
// The re-issue leg leaves the site, so the action uses `next/navigation`'s bare
// redirect. It throws like the real one, so a redirecting action can never look
// like a successful return.
vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT_EXTERNAL');
  },
}));

const { createFamilyForSocialUserAction, deleteMemberAction } =
  await import('@/modules/family/actions');
const { hasEverBeenMember } = await import('@/modules/family/queries');
const { idleState } = await import('@/modules/family/action-state');

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

describe.skipIf(!databaseUrl)('social onboarding (integration)', () => {
  const { pool, db } = createTestDb();
  const { family, formerMember, member, session, user } = schema;

  const users: string[] = [];

  /** A better-auth user row, created directly — this suite is not testing sign-up. */
  async function createUser(label: string): Promise<string> {
    const id = randomUUID();
    await db.insert(user).values({
      id,
      name: label,
      email: `${label}-${id.slice(0, 8)}@kynite.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    users.push(id);
    return id;
  }

  function signedInAs(userId: string, name: string) {
    stubs.session = {
      session: { activeFamilyId: null, memberId: null },
      user: { id: userId, name, email: `${name}@kynite.test` },
    };
  }

  async function membersOf(userId: string) {
    return db.select().from(member).where(eq(member.userId, userId));
  }

  beforeAll(async () => {
    stubs.db = db;

    /**
     * Warm two pooled connections before anything races.
     *
     * `pg` opens connections lazily, and the TCP + auth handshake for the
     * *second* one takes longer than the whole first transaction does — so an
     * unwarmed pool makes the two "concurrent" submits run one after the other
     * and the test passes against the very bug it exists to catch (verified:
     * with a cold pool, deleting the advisory lock still leaves it green; with
     * a warm one, it goes red).
     */
    const warm = await Promise.all([pool.connect(), pool.connect()]);
    for (const client of warm) client.release();
  });

  beforeEach(() => {
    stubs.signOut = async () => {};
    stubs.signInSocial = async () => ({
      url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1',
    });
  });

  afterAll(async () => {
    // `family` cascades to its members; the user rows take their sessions and
    // tombstones with them.
    for (const id of users) {
      const rows = await db
        .select({ familyId: member.familyId })
        .from(member)
        .where(eq(member.userId, id));
      for (const row of rows) await db.delete(family).where(eq(family.id, row.familyId));
      await db.delete(user).where(eq(user.id, id));
    }
    await pool.end();
  });

  it('creates exactly one household when the form is submitted twice at once', async () => {
    const userId = await createUser('race');
    signedInAs(userId, 'Sanne');

    // Both callers see "no member" if they are allowed to look before the other
    // commits. The advisory lock is what stops that, and only a real database
    // can be asked whether it worked.
    const results = await Promise.allSettled([
      createFamilyForSocialUserAction(idleState, form({ familyName: 'Familie Race' })),
      createFamilyForSocialUserAction(idleState, form({ familyName: 'Familie Race' })),
    ]);

    // Both legs end in a redirect (the winner off-site to Google, the loser to
    // /family) — neither is allowed to be a *returned* error.
    for (const result of results) {
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(String((result.reason as Error).message)).toMatch(/NEXT_REDIRECT/);
      }
    }

    expect(await membersOf(userId)).toHaveLength(1);

    const families = await db.select().from(family).where(eq(family.name, 'Familie Race'));
    expect(families).toHaveLength(1);
  });

  it('treats a later replay as a success rather than a second household', async () => {
    const userId = await createUser('replay');
    signedInAs(userId, 'Joris');

    await expect(
      createFamilyForSocialUserAction(idleState, form({ familyName: 'Familie Replay' }))
    ).rejects.toThrow(/NEXT_REDIRECT/);

    await expect(
      createFamilyForSocialUserAction(idleState, form({ familyName: 'Familie Replay Again' }))
    ).rejects.toThrow(/NEXT_REDIRECT/);

    expect(await membersOf(userId)).toHaveLength(1);
    expect(
      await db.select().from(family).where(eq(family.name, 'Familie Replay Again'))
    ).toHaveLength(0);
  });

  it('reports a failure when the unscoped session cannot be discarded', async () => {
    const userId = await createUser('signout');
    signedInAs(userId, 'Nadia');
    stubs.signOut = async () => {
      throw new Error('sign-out unavailable');
    };

    const result = await createFamilyForSocialUserAction(
      idleState,
      form({ familyName: 'Familie Signout' })
    );

    // The household stands; what must not happen is carrying on with a session
    // that can never become scoped.
    expect(result).toEqual({ status: 'error', error: 'onboardingSignOutFailed' });
    expect(await membersOf(userId)).toHaveLength(1);
  });

  it('revokes sessions and leaves a tombstone when a member is removed', async () => {
    const ownerUserId = await createUser('owner');
    const removedUserId = await createUser('removed');

    signedInAs(ownerUserId, 'Eva');
    await expect(
      createFamilyForSocialUserAction(idleState, form({ familyName: 'Familie Tombstone' }))
    ).rejects.toThrow(/NEXT_REDIRECT/);

    const [owner] = await membersOf(ownerUserId);

    const [second] = await db
      .insert(member)
      .values({
        familyId: owner.familyId,
        userId: removedUserId,
        displayName: 'Papa',
        role: 'adult',
        color: 'blue',
        sortOrder: 1,
      })
      .returning();

    await db.insert(session).values({
      id: randomUUID(),
      token: randomUUID(),
      userId: removedUserId,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
      activeFamilyId: owner.familyId,
      memberId: second.id,
    });

    // The owner is the one doing the removing.
    stubs.session = {
      session: { activeFamilyId: owner.familyId, memberId: owner.id },
      user: { id: ownerUserId, name: 'Eva', email: 'eva@kynite.test' },
    };

    expect(await deleteMemberAction(idleState, form({ memberId: second.id }))).toEqual(idleState);

    expect(await membersOf(removedUserId)).toHaveLength(0);
    expect(await db.select().from(session).where(eq(session.userId, removedUserId))).toHaveLength(
      0
    );
    expect(
      await db.select().from(formerMember).where(eq(formerMember.userId, removedUserId))
    ).toHaveLength(1);

    // The point of the tombstone: this login is no longer a first run, so
    // `(auth)/onboarding` will not offer it a household of its own.
    expect(await hasEverBeenMember(removedUserId)).toBe(true);
    expect(await hasEverBeenMember(randomUUID())).toBe(false);
  });
});
