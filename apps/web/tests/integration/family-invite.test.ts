import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hashInviteToken } from '@/lib/invite-token';
import { inviteStateOf } from '@/modules/family/domain/invite';
import { getAuth } from '@/server/auth';
import * as schema from '@/server/db/schema';
import {
  createTestDb,
  databaseUrl,
  expectRejection,
  seedHousehold,
  type Household,
} from './support/db';

/**
 * Framework seams only, for the `acceptInviteAction` suite (F11) further down
 * — `@/server/auth` and `@/server/db` are deliberately **not** mocked there,
 * matching `family-authorization.test.ts`'s stated bar: only the framework
 * seams are fake, so `signUpEmail`'s "this email already exists" is the real
 * better-auth/Postgres answer, not a stub agreeing with the code under test.
 */
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

/**
 * Second-parent invites against a real Postgres (M14, PRD FR26).
 *
 * These are database invariants, not application ones, and that distinction is
 * the reason this file exists rather than a mocked unit test: single use, the
 * expiry window, revocation and the two-browser race are all properties of the
 * predicates in `claimInvite`'s UPDATEs. A fake database would happily agree
 * with whatever the code believes; only a real one can be asked whether two
 * concurrent claims can both win.
 *
 * `@/modules/family/invites` is imported dynamically because it pulls in
 * `@/server/db`, which reads `DATABASE_URL` on first use.
 */
describe.skipIf(!databaseUrl)('second-parent invites (integration)', () => {
  const { pool, db } = createTestDb();

  let household: Household;
  let invites: typeof import('@/modules/family/invites');
  const users: string[] = [];

  /** A better-auth user row, created directly — this suite is not testing sign-up. */
  async function createUser(label: string): Promise<string> {
    const id = randomUUID();
    await db.insert(schema.user).values({
      id,
      name: label,
      email: `${label}-${id.slice(0, 8)}@kynite.test`,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    users.push(id);
    return id;
  }

  /** An unclaimed adult — the row a second-parent invite exists to hand over. */
  async function seedSecondParent(displayName = 'Papa'): Promise<string> {
    const [row] = await db
      .insert(schema.member)
      .values({
        familyId: household.familyId,
        displayName,
        role: 'adult',
        color: 'blue',
        sortOrder: 9,
      })
      .returning();

    return row.id;
  }

  async function mintFor(memberId: string) {
    const minted = await invites.mintInvite({
      familyId: household.familyId,
      memberId,
      email: `papa-${randomUUID().slice(0, 8)}@kynite.test`,
      invitedByMemberId: household.parentId,
    });

    expect(minted, 'expected the invite to be minted').not.toBeNull();
    return minted!;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
    process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

    invites = await import('@/modules/family/invites');

    household = await seedHousehold(db, 'Invite');
  });

  afterAll(async () => {
    await db.delete(schema.family).where(eq(schema.family.id, household.familyId));
    for (const id of users) {
      await db.delete(schema.user).where(eq(schema.user.id, id));
    }
    await pool.end();
  });

  describe('minting', () => {
    it('stores only the hash — the raw token is returned and never written down', async () => {
      const memberId = await seedSecondParent();
      const { invite, token } = await mintFor(memberId);

      const [stored] = await db
        .select()
        .from(schema.memberInvite)
        .where(eq(schema.memberInvite.id, invite.id));

      expect(stored.tokenHash).toBe(hashInviteToken(token));
      expect(stored.tokenHash).not.toContain(token);
      expect(JSON.stringify(stored)).not.toContain(token);
    });

    it('refuses a member who already has a login', async () => {
      const memberId = await seedSecondParent();
      const userId = await createUser('claimed-already');
      await db.update(schema.member).set({ userId }).where(eq(schema.member.id, memberId));

      const minted = await invites.mintInvite({
        familyId: household.familyId,
        memberId,
        email: 'nope@kynite.test',
        invitedByMemberId: household.parentId,
      });

      expect(minted).toBeNull();
    });

    /**
     * The anti-escalation property, tested from the outside. There is no role
     * parameter to abuse, so the attack that remains is pointing an invite at a
     * row that is *already* privileged — the owner. The predicate refuses it.
     */
    it('refuses the owner and refuses a child', async () => {
      for (const memberId of [household.parentId, household.childId]) {
        const minted = await invites.mintInvite({
          familyId: household.familyId,
          memberId,
          email: 'nope@kynite.test',
          invitedByMemberId: household.parentId,
        });

        expect(minted).toBeNull();
      }
    });

    it('refuses a member in another family', async () => {
      const other = await seedHousehold(db, 'InviteOtherFamily');

      const minted = await invites.mintInvite({
        familyId: household.familyId,
        memberId: other.parentId,
        email: 'nope@kynite.test',
        invitedByMemberId: household.parentId,
      });

      expect(minted).toBeNull();
      await db.delete(schema.family).where(eq(schema.family.id, other.familyId));
    });

    it('allows only one live invite per member', async () => {
      const memberId = await seedSecondParent();
      await mintFor(memberId);

      await expectRejection(
        invites.mintInvite({
          familyId: household.familyId,
          memberId,
          email: 'second@kynite.test',
          invitedByMemberId: household.parentId,
        }),
        /member_invite_live_member_unique/
      );
    });

    it('lets a revoked invite be replaced', async () => {
      const memberId = await seedSecondParent();
      const first = await mintFor(memberId);

      expect(await invites.revokeInvite(household.familyId, first.invite.id)).toBe(true);

      const second = await mintFor(memberId);
      expect(second.invite.id).not.toBe(first.invite.id);
      expect(second.token).not.toBe(first.token);
    });
  });

  describe('resolving', () => {
    it('finds an invite by its raw token, and nothing by a wrong one', async () => {
      const memberId = await seedSecondParent('Resolvable');
      const { invite, token } = await mintFor(memberId);

      const resolved = await invites.resolveInvite(token);
      expect(resolved?.invite.id).toBe(invite.id);
      expect(resolved?.member.displayName).toBe('Resolvable');
      expect(resolved?.familyName).toContain('Invite');

      expect(await invites.resolveInvite('not-a-token')).toBeNull();
      expect(await invites.resolveInvite('a'.repeat(43))).toBeNull();
    });
  });

  describe('claiming', () => {
    /**
     * **The M14 criterion, stated as directly as it can be:** accepting an
     * invite attaches a login to an *existing* member row. The id is captured
     * before the claim and compared after it, because everything else in the
     * household — routines this person owns, events assigned to them, their
     * star ledger — is a foreign key onto that id. An implementation that
     * created a member and copied the fields across would pass every other test
     * in this file and silently orphan all of it.
     */
    it('attaches the user to the existing member row — same id, nothing created', async () => {
      const memberId = await seedSecondParent('Papa Unchanged');
      const { invite } = await mintFor(memberId);
      const userId = await createUser('claimant');

      const before = await db
        .select()
        .from(schema.member)
        .where(eq(schema.member.familyId, household.familyId));

      const result = await invites.claimInvite({ inviteId: invite.id, userId });

      expect(result.ok).toBe(true);
      expect(result.ok && result.member.id).toBe(memberId);
      expect(result.ok && result.member.userId).toBe(userId);
      // Claim, not create: the roster is exactly as long as it was.
      const after = await db
        .select()
        .from(schema.member)
        .where(eq(schema.member.familyId, household.familyId));
      expect(after).toHaveLength(before.length);

      const [row] = await db.select().from(schema.member).where(eq(schema.member.id, memberId));
      expect(row.userId).toBe(userId);
      // The row it always was: display name, colour and role are untouched.
      expect(row.displayName).toBe('Papa Unchanged');
      expect(row.role).toBe('adult');
    });

    /** §7's adult column, not the owner's. An invite cannot promote anybody. */
    it('leaves the claimed member on the adult role', async () => {
      const memberId = await seedSecondParent();
      const { invite } = await mintFor(memberId);
      const userId = await createUser('still-adult');

      await invites.claimInvite({ inviteId: invite.id, userId });

      const [row] = await db.select().from(schema.member).where(eq(schema.member.id, memberId));
      expect(row.role).toBe('adult');

      const owners = await db
        .select()
        .from(schema.member)
        .where(eq(schema.member.familyId, household.familyId));
      expect(owners.filter((each) => each.role === 'owner')).toHaveLength(1);
    });

    it('cannot be replayed: a second use reports alreadyClaimed', async () => {
      const memberId = await seedSecondParent();
      const { invite } = await mintFor(memberId);
      const first = await createUser('first-use');
      const second = await createUser('second-use');

      expect((await invites.claimInvite({ inviteId: invite.id, userId: first })).ok).toBe(true);

      const replay = await invites.claimInvite({ inviteId: invite.id, userId: second });
      expect(replay).toEqual({ ok: false, reason: 'alreadyClaimed' });

      // And the replay changed nothing: the member still belongs to the first user.
      const [row] = await db.select().from(schema.member).where(eq(schema.member.id, memberId));
      expect(row.userId).toBe(first);
    });

    /**
     * Two browsers, one link, at the same instant. Postgres serialises the
     * UPDATEs on the invite row, so the predicate `claimed_at IS NULL` is true
     * for exactly one of them — which is the whole reason validation lives in
     * the WHERE clause rather than in a read-then-write above it.
     */
    it('lets exactly one of two concurrent claims win', async () => {
      const memberId = await seedSecondParent();
      const { invite } = await mintFor(memberId);
      const left = await createUser('race-left');
      const right = await createUser('race-right');

      const [a, b] = await Promise.all([
        invites.claimInvite({ inviteId: invite.id, userId: left }),
        invites.claimInvite({ inviteId: invite.id, userId: right }),
      ]);

      expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);

      const winner = a.ok ? left : right;
      const [row] = await db.select().from(schema.member).where(eq(schema.member.id, memberId));
      expect(row.userId).toBe(winner);

      const [stored] = await db
        .select()
        .from(schema.memberInvite)
        .where(eq(schema.memberInvite.id, invite.id));
      expect(stored.claimedByUserId).toBe(winner);
    });

    it('refuses an expired invite', async () => {
      const memberId = await seedSecondParent();
      const { invite } = await mintFor(memberId);
      const userId = await createUser('too-late');

      await db
        .update(schema.memberInvite)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(schema.memberInvite.id, invite.id));

      expect(await invites.claimInvite({ inviteId: invite.id, userId })).toEqual({
        ok: false,
        reason: 'expired',
      });

      const [row] = await db.select().from(schema.member).where(eq(schema.member.id, memberId));
      expect(row.userId).toBeNull();
    });

    it('refuses a revoked invite', async () => {
      const memberId = await seedSecondParent();
      const { invite } = await mintFor(memberId);
      const userId = await createUser('revoked-out');

      expect(await invites.revokeInvite(household.familyId, invite.id)).toBe(true);

      expect(await invites.claimInvite({ inviteId: invite.id, userId })).toEqual({
        ok: false,
        reason: 'revoked',
      });

      const [row] = await db.select().from(schema.member).where(eq(schema.member.id, memberId));
      expect(row.userId).toBeNull();
    });

    it('refuses an invite that does not exist', async () => {
      expect(
        await invites.claimInvite({ inviteId: randomUUID(), userId: await createUser('ghost') })
      ).toEqual({ ok: false, reason: 'notFound' });
    });
  });

  describe('revocation', () => {
    it('is family-scoped and idempotent', async () => {
      const memberId = await seedSecondParent();
      const { invite } = await mintFor(memberId);
      const other = await seedHousehold(db, 'InviteRevokeScope');

      // Another family cannot reach in and revoke this one's invite.
      expect(await invites.revokeInvite(other.familyId, invite.id)).toBe(false);

      expect(await invites.revokeInvite(household.familyId, invite.id)).toBe(true);
      // A second tap is not an error and not a second write.
      expect(await invites.revokeInvite(household.familyId, invite.id)).toBe(false);

      await db.delete(schema.family).where(eq(schema.family.id, other.familyId));
    });

    it('cannot take back an invite that was already accepted', async () => {
      const memberId = await seedSecondParent();
      const { invite } = await mintFor(memberId);
      const userId = await createUser('already-in');

      await invites.claimInvite({ inviteId: invite.id, userId });

      expect(await invites.revokeInvite(household.familyId, invite.id)).toBe(false);

      const [stored] = await db
        .select()
        .from(schema.memberInvite)
        .where(eq(schema.memberInvite.id, invite.id));

      expect(inviteStateOf(stored, new Date())).toBe('claimed');
    });
  });

  describe('listing', () => {
    it('shows live invites through findLiveInvite and history through listInvites', async () => {
      const memberId = await seedSecondParent('Listed');
      const { invite } = await mintFor(memberId);

      expect((await invites.findLiveInvite(household.familyId, memberId))?.id).toBe(invite.id);

      await invites.revokeInvite(household.familyId, invite.id);
      expect(await invites.findLiveInvite(household.familyId, memberId)).toBeNull();

      const all = await invites.listInvites(household.familyId);
      expect(all.map((each) => each.id)).toContain(invite.id);
      // Newest first, so the roster can take the first row per member.
      const timestamps = all.map((each) => each.createdAt.getTime());
      expect([...timestamps].sort((a, b) => b - a)).toEqual(timestamps);
    });
  });

  /**
   * F11: `acceptInviteAction`'s email-taken branch, exercised end to end
   * against a real better-auth instance on the same test database — not a
   * mocked "throw a unique-ish error" stand-in. Only the framework seams
   * (`next/headers`, `next/cache`, `next-intl/server`, `@/i18n/navigation`) are
   * faked; `@/server/auth` and `@/server/db` are real, so `signUpEmail`
   * refusing a duplicate email is better-auth's own answer.
   *
   * Three things have to hold together, and any one of them failing is worse
   * than the error screen: the invite must still say `inviteEmailTaken`, the
   * invite itself must **not** be spent (the invitee typed the wrong email by
   * mistake, or shares one with someone else in the house — they should be
   * able to try again), and no orphaned auth user should be left behind from
   * the failed `signUpEmail` attempt (there shouldn't have been one — the
   * point of this test is proving that, not compensating for it).
   */
  describe('accepting with an email that is already taken (F11)', () => {
    it('reports inviteEmailTaken, leaves the invite claimable, and creates no orphan user', async () => {
      const { acceptInviteAction } = await import('@/modules/family/actions');

      const takenEmail = `taken-${randomUUID().slice(0, 8)}@kynite.test`;
      const existing = await getAuth().api.signUpEmail({
        body: { name: 'Existing Account', email: takenEmail, password: 'x'.repeat(16) },
        headers: new Headers(),
      });
      users.push(existing.user.id);

      const memberId = await seedSecondParent('Papa EmailTaken');
      const minted = await invites.mintInvite({
        familyId: household.familyId,
        memberId,
        email: takenEmail,
        invitedByMemberId: household.parentId,
      });
      expect(minted, 'expected the invite to be minted').not.toBeNull();
      const { token } = minted!;

      const form = new FormData();
      form.set('token', token);

      const result = await acceptInviteAction({ status: 'idle' }, form);

      expect(result).toEqual({ status: 'error', error: 'inviteEmailTaken' });

      // Still claimable: the invitee gets another shot rather than a burnt link.
      const resolved = await invites.resolveInvite(token);
      expect(resolved).not.toBeNull();
      expect(inviteStateOf(resolved!.invite, new Date())).toBe('pending');

      // No orphan: exactly the one user this test created directly, nothing
      // `acceptInviteAction`'s failed `signUpEmail` attempt left behind.
      const usersWithEmail = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.email, takenEmail));
      expect(usersWithEmail).toHaveLength(1);
      expect(usersWithEmail[0]?.id).toBe(existing.user.id);

      // The member row was never claimed.
      const [row] = await db.select().from(schema.member).where(eq(schema.member.id, memberId));
      expect(row.userId).toBeNull();
    });
  });
});
