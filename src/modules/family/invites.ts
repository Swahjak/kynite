import 'server-only';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/server/db';
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiry,
  isInviteTokenShaped,
} from '@/lib/invite-token';
import { family, member, memberInvite, type Member, type MemberInvite } from './schema';

/**
 * Second-parent invite reads and writes (PRD FR26, milestone M14).
 *
 * Server-side only, like every other query file in the slice. Everything that
 * makes an invite *safe* — single use, expiry, revocation, family scope, "the
 * target row must still be unclaimed" — lives in a WHERE clause here rather
 * than in a branch in the calling action. That is the M12 pairing lesson
 * applied to a second credential: a read-then-write leaves a window between the
 * check and the write in which a second browser can slip through, and the only
 * way to close it is to make the validation *be* the predicate of the write.
 */

export type InviteWithMember = {
  invite: MemberInvite;
  member: Member;
  familyName: string;
};

/** What `mintInvite` hands back — the raw token exists here and nowhere else. */
export type MintedInvite = {
  invite: MemberInvite;
  token: string;
};

/**
 * Mint an invite for one already-existing, still-unclaimed member row.
 *
 * The target is re-read inside the transaction and locked (`FOR UPDATE`) before
 * the insert, so a member who is claimed concurrently cannot also acquire a
 * fresh invite. Three things must hold, and none of them is supplied by the
 * caller: the row is in this family, its role is invitable (`adult` — see
 * `INVITABLE_ROLES`), and it has no login yet. The role is read from the row
 * rather than accepted as a parameter, which is what makes escalation
 * impossible by construction rather than by validation.
 *
 * A second live invite for the same member is refused by the partial unique
 * index `member_invite_live_member_unique`, not by a branch here.
 */
export async function mintInvite(input: {
  familyId: string;
  memberId: string;
  email: string;
  invitedByMemberId: string;
  now?: Date;
}): Promise<MintedInvite | null> {
  const now = input.now ?? new Date();
  const token = generateInviteToken();

  return getDb().transaction(async (tx) => {
    const [target] = await tx
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.id, input.memberId),
          eq(member.familyId, input.familyId),
          eq(member.role, 'adult'),
          isNull(member.userId)
        )
      )
      .limit(1)
      .for('update');

    if (!target) return null;

    const [invite] = await tx
      .insert(memberInvite)
      .values({
        familyId: input.familyId,
        memberId: target.id,
        tokenHash: hashInviteToken(token),
        email: input.email,
        invitedByMemberId: input.invitedByMemberId,
        expiresAt: inviteExpiry(now),
      })
      .returning();

    return { invite, token };
  });
}

/**
 * Resolve a raw token from the URL into the invite, its target member and the
 * household's name — with no state check at all.
 *
 * The caller decides what an expired or revoked invite *looks like*, because
 * the friendly already-claimed screen (M14 acceptance criteria) needs the
 * member and family names to say anything useful. Malformed tokens are rejected
 * before any query: `/invite/<anything>` is unauthenticated, so a scan should
 * cost nothing.
 */
export async function resolveInvite(rawToken: string): Promise<InviteWithMember | null> {
  if (!isInviteTokenShaped(rawToken)) return null;

  const [row] = await getDb()
    .select({ invite: memberInvite, member, familyName: family.name })
    .from(memberInvite)
    .innerJoin(member, eq(member.id, memberInvite.memberId))
    .innerJoin(family, eq(family.id, memberInvite.familyId))
    .where(eq(memberInvite.tokenHash, hashInviteToken(rawToken)))
    .limit(1);

  return row ?? null;
}

/**
 * Live invites first, then spent ones — the owner's roster list.
 *
 * `tokenHash` is deliberately **not** selected, matching
 * `modules/sharing/queries.ts`'s `listShareLinks` precedent: it is useless to
 * the UI, and a column that never leaves the database is a column that cannot
 * end up in a server-component payload, a log line or a React DevTools tree.
 */
export type InviteListEntry = Omit<MemberInvite, 'tokenHash'>;

export async function listInvites(familyId: string): Promise<InviteListEntry[]> {
  return getDb()
    .select({
      id: memberInvite.id,
      familyId: memberInvite.familyId,
      memberId: memberInvite.memberId,
      email: memberInvite.email,
      invitedByMemberId: memberInvite.invitedByMemberId,
      expiresAt: memberInvite.expiresAt,
      claimedAt: memberInvite.claimedAt,
      claimedByUserId: memberInvite.claimedByUserId,
      revokedAt: memberInvite.revokedAt,
      profileCompletedAt: memberInvite.profileCompletedAt,
      createdAt: memberInvite.createdAt,
      updatedAt: memberInvite.updatedAt,
    })
    .from(memberInvite)
    .where(eq(memberInvite.familyId, familyId))
    .orderBy(desc(memberInvite.createdAt));
}

/** The live invite for one member, if any — drives the roster's Invite button. */
export async function findLiveInvite(
  familyId: string,
  memberId: string
): Promise<MemberInvite | null> {
  const [row] = await getDb()
    .select()
    .from(memberInvite)
    .where(
      and(
        eq(memberInvite.familyId, familyId),
        eq(memberInvite.memberId, memberId),
        isNull(memberInvite.claimedAt),
        isNull(memberInvite.revokedAt)
      )
    )
    .limit(1);

  return row ?? null;
}

/**
 * Revoke. Family-scoped, and `false` for an invite that was already spent or
 * already revoked — the predicate says so, so a double-tap is not an error and
 * not a second write.
 */
export async function revokeInvite(familyId: string, inviteId: string): Promise<boolean> {
  const now = new Date();
  const rows = await getDb()
    .update(memberInvite)
    .set({ revokedAt: now, updatedAt: now })
    .where(
      and(
        eq(memberInvite.id, inviteId),
        eq(memberInvite.familyId, familyId),
        isNull(memberInvite.claimedAt),
        isNull(memberInvite.revokedAt)
      )
    )
    .returning({ id: memberInvite.id });

  return rows.length === 1;
}

export type ClaimFailure = 'notFound' | 'alreadyClaimed' | 'revoked' | 'expired' | 'memberTaken';

export type ClaimResult =
  { ok: true; member: Member; invite: MemberInvite } | { ok: false; reason: ClaimFailure };

/**
 * Attach a login to the member row this invite points at — the heart of M14.
 *
 * Two writes, both guarded, in one transaction:
 *
 *  1. **The latch.** `UPDATE member_invite SET claimed_at = now() WHERE id = ?
 *     AND claimed_at IS NULL AND revoked_at IS NULL AND expires_at > now()`.
 *     Postgres serialises concurrent UPDATEs on the same row, so of two
 *     browsers presenting the same link at the same instant exactly one gets a
 *     row back and the other gets zero. Single-use, un-replayable, expiry and
 *     revocation are all *this one predicate* — there is no separate check to
 *     race against.
 *
 *  2. **The claim.** `UPDATE member SET user_id = ? WHERE id = ? AND user_id IS
 *     NULL AND family_id = ?`. Note what this is not: it is not an INSERT. The
 *     member row was created by the owner long before the invite existed, and
 *     its `id` is untouched by acceptance — every foreign key already pointing
 *     at this person (routines they own, events assigned to them, stars) keeps
 *     pointing at the same row. That is the entire reason `member` is decoupled
 *     from the auth `user` in §3, and it is what the integration test asserts.
 *
 * If the second write finds nothing (someone claimed the member by another
 * route between the two statements) the transaction rolls back, which puts the
 * latch back too — the invite is spendable again rather than burnt on a failure
 * that was not the invitee's.
 */
export async function claimInvite(input: {
  inviteId: string;
  userId: string;
  now?: Date;
}): Promise<ClaimResult> {
  const now = input.now ?? new Date();
  const db = getDb();

  try {
    return await claimInTransaction(db, input.inviteId, input.userId, now);
  } catch (error) {
    // `tx.rollback()` signals the member-taken case by throwing (that is its
    // only way to abort), so the sentinel has to be translated back here rather
    // than escaping as a database error to the caller.
    if (isRollbackSignal(error)) return { ok: false, reason: 'memberTaken' };
    throw error;
  }
}

function isRollbackSignal(error: unknown): boolean {
  return error instanceof Error && error.name === 'TransactionRollbackError';
}

async function claimInTransaction(
  db: ReturnType<typeof getDb>,
  inviteId: string,
  userId: string,
  now: Date
): Promise<ClaimResult> {
  return db.transaction(async (tx) => {
    const [latched] = await tx
      .update(memberInvite)
      .set({ claimedAt: now, claimedByUserId: userId, updatedAt: now })
      .where(
        and(
          eq(memberInvite.id, inviteId),
          isNull(memberInvite.claimedAt),
          isNull(memberInvite.revokedAt),
          sql`${memberInvite.expiresAt} > ${now}`
        )
      )
      .returning();

    if (!latched) {
      // Nothing was updated. Read the row back to say *why*, so the screen can
      // be specific ("already used" vs "expired") instead of a shrug.
      const [existing] = await tx
        .select()
        .from(memberInvite)
        .where(eq(memberInvite.id, inviteId))
        .limit(1);

      if (!existing) return { ok: false, reason: 'notFound' };
      if (existing.claimedAt) return { ok: false, reason: 'alreadyClaimed' };
      if (existing.revokedAt) return { ok: false, reason: 'revoked' };
      return { ok: false, reason: 'expired' };
    }

    const [claimed] = await tx
      .update(member)
      .set({ userId, updatedAt: now })
      .where(
        and(
          eq(member.id, latched.memberId),
          eq(member.familyId, latched.familyId),
          isNull(member.userId)
        )
      )
      .returning();

    if (!claimed) {
      // Roll the latch back with the claim: a spent invite that handed over
      // nothing is the one outcome worse than either half failing alone.
      tx.rollback();
    }

    return { ok: true, member: claimed, invite: latched };
  });
}
