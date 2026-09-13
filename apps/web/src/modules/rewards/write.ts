import 'server-only';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/server/db';
// Table objects come from the schema assembly point, not a slice barrel —
// same note as `./actions.ts` and `modules/timers/write.ts`.
import { member, memberStarBalance, redemption, reward, starLedger } from '@/server/db/schema';
import { can, getMember, type Principal } from '@/modules/family';
import { publish } from '@/modules/realtime';
import {
  actionFailure as failure,
  idleState,
  redemptionFailure,
  type ActionState,
  type RedemptionState,
} from './action-state';
import { canAfford, starTotals } from './domain/economy';
import { notifyRedemption } from './notify-bridge';
import { isOpen, statusForDecision, REDEMPTION_DECISIONS } from './domain/redemption';
import { REWARD_CATEGORIES } from './schema';
import { isRewardIcon } from './ui/tokens';

/**
 * The write seam for the rewards slice (MCP milestone M3).
 *
 * Same shape and the same discipline as `modules/timers/write.ts` and
 * `modules/routines/write.ts`: every function takes an explicit `Principal`,
 * calls `can()` itself rather than trusting the caller, validates its own
 * input, and imports nothing from `next/cache` — revalidation is the
 * caller's concern (`./actions.ts` does it for the web app; `/api/mcp`'s
 * tools do not, since there is no page to revalidate). `./actions.ts` is now
 * a set of thin wrappers over these (assertCan → delegate → revalidate),
 * and `/api/mcp/tools/rewards.ts` calls the same functions with the
 * principal resolved from a bearer token. MCP never imports a Server Action.
 *
 * Every publish/realtime/notification side effect that used to live in
 * `actions.ts` moved here with the write it belongs to — a redemption an MCP
 * client requests is exactly as live on the wall as one a Server Action
 * started.
 *
 * The same hard invariant as before governs the whole file: **nothing here
 * writes a negative star, and nothing here updates or deletes a
 * `star_ledger` row** — enforced by `tests/unit/append-only-star-ledger.test.ts`
 * and the database's own `CHECK (amount > 0)`.
 *
 * `seedRewardPresetsAction` is deliberately not extracted: it is UI-only
 * onboarding (the presets' titles arrive already translated from the
 * client), not something an MCP client has any use for.
 */

const trimmed = z.string().trim();

/**
 * The realtime `actor` for a principal. A `member` principal names itself; a
 * paired kiosk names its device.
 */
function actorOf(principal: Principal): { memberId?: string; deviceId?: string } {
  if (principal.kind === 'member') return { memberId: principal.memberId };
  if (principal.kind === 'device') return { deviceId: principal.deviceId };
  return {};
}

/** Every restricted-to member must actually be in this family. */
async function membersExist(familyId: string, memberIds: readonly string[]): Promise<boolean> {
  for (const memberId of memberIds) {
    if (!(await getMember(familyId, memberId))) return false;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/* catalogue                                                                  */
/* -------------------------------------------------------------------------- */

const rewardBodySchema = z.object({
  title: trimmed.min(1).max(120),
  icon: trimmed.refine(isRewardIcon),
  costStars: z.number().int().min(1).max(500),
  category: z.enum(REWARD_CATEGORIES),
  /** Empty = every child in the family. */
  availableToMemberIds: z.array(z.uuid()).default([]),
  active: z.boolean().default(true),
});

export type RewardInput = z.input<typeof rewardBodySchema>;

export async function createReward(principal: Principal, input: RewardInput): Promise<ActionState> {
  if (!can(principal, 'reward:manage', { familyId: principal.familyId })) {
    return failure('forbidden');
  }

  const parsed = rewardBodySchema.safeParse(input);
  if (!parsed.success) return failure('invalidInput');

  const body = parsed.data;
  if (!(await membersExist(principal.familyId, body.availableToMemberIds))) {
    return failure('memberNotFound');
  }

  await getDb().insert(reward).values({
    familyId: principal.familyId,
    title: body.title,
    icon: body.icon,
    costStars: body.costStars,
    category: body.category,
    availableToMemberIds: body.availableToMemberIds,
    active: body.active,
  });

  return idleState;
}

export type UpdateRewardInput = RewardInput & { rewardId: string };

export async function updateReward(
  principal: Principal,
  input: UpdateRewardInput
): Promise<ActionState> {
  if (!can(principal, 'reward:manage', { familyId: principal.familyId })) {
    return failure('forbidden');
  }

  if (!z.uuid().safeParse(input.rewardId).success) return failure('invalidInput');

  const parsed = rewardBodySchema.safeParse(input);
  if (!parsed.success) return failure('invalidInput');

  const body = parsed.data;
  if (!(await membersExist(principal.familyId, body.availableToMemberIds))) {
    return failure('memberNotFound');
  }

  const updated = await getDb()
    .update(reward)
    .set({
      title: body.title,
      icon: body.icon,
      // Re-pricing the shelf never re-prices a request already in flight:
      // `redemption.costStars` was frozen when the child asked.
      costStars: body.costStars,
      category: body.category,
      availableToMemberIds: body.availableToMemberIds,
      active: body.active,
      updatedAt: new Date(),
    })
    .where(and(eq(reward.id, input.rewardId), eq(reward.familyId, principal.familyId)))
    .returning({ id: reward.id });

  if (updated.length === 0) return failure('rewardNotFound');

  return idleState;
}

export type DeleteRewardInput = { rewardId: string };

export async function deleteReward(
  principal: Principal,
  input: DeleteRewardInput
): Promise<ActionState> {
  if (!can(principal, 'reward:manage', { familyId: principal.familyId })) {
    return failure('forbidden');
  }

  if (!z.uuid().safeParse(input.rewardId).success) return failure('invalidInput');

  // Removing a reward cascades its redemption history away with it — and, by
  // construction, does not touch `star_ledger`: a redemption's cost stops
  // being subtracted, so *available* stars can only go up. Earned stars are
  // untouched either way, which is the invariant that matters.
  const deleted = await getDb()
    .delete(reward)
    .where(and(eq(reward.id, input.rewardId), eq(reward.familyId, principal.familyId)))
    .returning({ id: reward.id });

  if (deleted.length === 0) return failure('rewardNotFound');

  return idleState;
}

/* -------------------------------------------------------------------------- */
/* stars                                                                      */
/* -------------------------------------------------------------------------- */

const awardSchema = z.object({
  memberId: z.uuid(),
  amount: z.number().int().min(1).max(20),
  reason: z.enum(['bonus', 'manual', 'surprise']),
  note: trimmed.max(200).optional(),
});

export type AwardStarsInput = z.input<typeof awardSchema>;

export async function awardStars(
  principal: Principal,
  input: AwardStarsInput
): Promise<ActionState> {
  if (!can(principal, 'stars:award', { familyId: principal.familyId })) {
    return failure('forbidden');
  }

  const parsed = awardSchema.safeParse(input);
  if (!parsed.success) return failure('invalidInput');

  const { memberId, amount, reason, note } = parsed.data;

  // A uuid from the caller. `getMember` returns null for an id that exists
  // but belongs to another family — a forged id addresses nothing.
  if (!(await getMember(principal.familyId, memberId))) return failure('memberNotFound');

  await getDb().transaction(async (tx) => {
    const [entry] = await tx
      .insert(starLedger)
      .values({
        familyId: principal.familyId,
        memberId,
        amount,
        reason,
        note: note ?? null,
      })
      .returning({ id: starLedger.id });

    await publish(
      {
        familyId: principal.familyId,
        type: 'stars.awarded',
        entity: { id: entry.id },
        actor: { ...actorOf(principal), source: 'mobile' },
        patch: { amount, reason, memberId },
      },
      tx
    );
  });

  return idleState;
}

/* -------------------------------------------------------------------------- */
/* redemption                                                                 */
/* -------------------------------------------------------------------------- */

const requestSchema = z.object({
  rewardId: z.uuid(),
  memberId: z.uuid(),
  /**
   * The idempotency key, minted by the client *before* the request leaves the
   * device (§4) and derived from `(member, reward, day)` by
   * `domain/redemption.redemptionSeed` — so a retry after a dropped
   * connection reuses the same key by construction rather than by
   * remembering to.
   */
  clientId: trimmed.min(8).max(200),
});

export type RequestRedemptionInput = z.infer<typeof requestSchema>;

/**
 * A child (or an MCP client acting for one) asks for a reward (FR16).
 *
 * The write is a single insert with `ON CONFLICT DO NOTHING`, absorbing both
 * unique indexes at once: `unique(clientId)` and the partial
 * `unique(memberId, rewardId) where status = 'requested'`. **No stars move
 * here.** A request is a question; only approval spends.
 */
export async function requestRedemption(
  principal: Principal,
  input: RequestRedemptionInput
): Promise<RedemptionState> {
  if (
    !can(principal, 'redemption:request', {
      familyId: principal.familyId,
      memberId: input.memberId,
    })
  ) {
    return redemptionFailure('forbidden');
  }

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return redemptionFailure('invalidInput');

  const { rewardId, memberId, clientId } = parsed.data;

  const db = getDb();

  const child = await getMember(principal.familyId, memberId);
  if (!child) {
    return redemptionFailure('memberNotFound');
  }

  const [target] = await db
    .select()
    .from(reward)
    .where(
      and(eq(reward.id, rewardId), eq(reward.familyId, principal.familyId), eq(reward.active, true))
    )
    .limit(1);

  if (!target) return redemptionFailure('rewardNotFound');

  // A restricted reward is not on this child's shelf at all.
  if (target.availableToMemberIds.length > 0 && !target.availableToMemberIds.includes(memberId)) {
    return redemptionFailure('rewardNotFound');
  }

  const [balance] = await db
    .select()
    .from(memberStarBalance)
    .where(
      and(
        eq(memberStarBalance.familyId, principal.familyId),
        eq(memberStarBalance.memberId, memberId)
      )
    )
    .limit(1);

  const totals = starTotals({
    earned: balance?.earnedStars ?? 0,
    spent: balance?.spentStars ?? 0,
  });

  // Defence in depth, not a message: the store never renders the button for a
  // reward that is out of reach, so this only catches a forged request.
  if (!canAfford(target.costStars, totals.available)) {
    return redemptionFailure('notEnoughStars');
  }

  // Captured out of the transaction so the notification fan-out below can run
  // *after* the commit: a push about a request that then rolled back would be
  // a parent looking for something that does not exist.
  let requestedId: string | null = null;

  const result = await db.transaction(async (tx): Promise<RedemptionState> => {
    const [inserted] = await tx
      .insert(redemption)
      .values({
        familyId: principal.familyId,
        memberId,
        rewardId,
        // Frozen here: re-pricing the catalogue never re-prices this request.
        costStars: target.costStars,
        status: 'requested',
        clientId,
      })
      // No conflict *target*: this has to absorb both unique indexes at once —
      // the clientId replay and the open-request double tap.
      .onConflictDoNothing()
      .returning({ id: redemption.id });

    if (!inserted) return { status: 'requested', replayed: true } as const;

    requestedId = inserted.id;

    await publish(
      {
        familyId: principal.familyId,
        type: 'redemption.requested',
        entity: { id: inserted.id },
        actor: { memberId, source: 'hub' },
        patch: { rewardId, memberId, costStars: target.costStars },
      },
      tx
    );

    return { status: 'requested', replayed: false } as const;
  });

  // §6 step 4: "Redemption requests fan out to all adults" — never awaited
  // into the critical path in any meaningful sense: it is after the commit,
  // and a failure is swallowed.
  if (requestedId) {
    await notifyRedemption({
      familyId: principal.familyId,
      redemptionId: requestedId,
      childName: child.displayName,
      rewardTitle: target.title,
    }).catch(() => 0);
  }

  return result;
}

const decideSchema = z.object({
  redemptionId: z.uuid(),
  decision: z.enum(REDEMPTION_DECISIONS),
});

export type DecideRedemptionInput = z.input<typeof decideSchema>;

/**
 * A parent approves or denies an open request (FR16, §7 `redemption:approve`).
 *
 * See the doc comment this carried over from `actions.ts` (still true here):
 * the row is locked `for update`, and approval additionally locks the
 * *member* row before reading the balance, so two parents approving two
 * different requests for the same child cannot both pass the affordability
 * check against a balance neither has actually committed against yet.
 */
export async function decideRedemption(
  principal: Principal,
  input: DecideRedemptionInput
): Promise<ActionState> {
  if (!can(principal, 'redemption:approve', { familyId: principal.familyId })) {
    return failure('forbidden');
  }

  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) return failure('invalidInput');

  const { redemptionId, decision } = parsed.data;
  const nextStatus = statusForDecision(decision);

  return getDb().transaction(async (tx): Promise<ActionState> => {
    const [existing] = await tx
      .select()
      .from(redemption)
      .where(and(eq(redemption.id, redemptionId), eq(redemption.familyId, principal.familyId)))
      .limit(1)
      .for('update');

    if (!existing) return failure('redemptionNotFound');
    // Already decided by whoever got here first — not an error worth alarming
    // about, but not a second decision either.
    if (!isOpen(existing.status)) return failure('alreadyDecided');

    if (decision === 'approve') {
      // Serialises on the child, not the request: a second parent approving a
      // *different* request for the same member blocks here until this
      // transaction commits, instead of reading the balance concurrently and
      // passing an affordability check that only holds one-at-a-time.
      await tx.select().from(member).where(eq(member.id, existing.memberId)).for('update');

      const [balance] = await tx
        .select()
        .from(memberStarBalance)
        .where(
          and(
            eq(memberStarBalance.familyId, principal.familyId),
            eq(memberStarBalance.memberId, existing.memberId)
          )
        )
        .limit(1);

      const totals = starTotals({
        earned: balance?.earnedStars ?? 0,
        spent: balance?.spentStars ?? 0,
      });

      if (!canAfford(existing.costStars, totals.available)) return failure('notEnoughStars');
    }

    await tx
      .update(redemption)
      .set({
        status: nextStatus,
        decidedAt: new Date(),
        decidedByMemberId: principal.kind === 'member' ? principal.memberId : null,
        updatedAt: new Date(),
      })
      .where(and(eq(redemption.id, redemptionId), eq(redemption.familyId, principal.familyId)));

    await publish(
      {
        familyId: principal.familyId,
        type: 'redemption.decided',
        entity: { id: redemptionId },
        actor: { ...actorOf(principal), source: 'mobile' },
        patch: { status: nextStatus, memberId: existing.memberId },
      },
      tx
    );

    return idleState;
  });
}

const fulfillSchema = z.object({ redemptionId: z.uuid() });

export type FulfillRedemptionInput = z.input<typeof fulfillSchema>;

/**
 * "Handed over" — `approved` becomes `fulfilled`. Both states spend, so this
 * moves no stars; it is bookkeeping that tells the approval queue which
 * granted rewards are still outstanding.
 */
export async function fulfillRedemption(
  principal: Principal,
  input: FulfillRedemptionInput
): Promise<ActionState> {
  if (!can(principal, 'redemption:approve', { familyId: principal.familyId })) {
    return failure('forbidden');
  }

  const parsed = fulfillSchema.safeParse(input);
  if (!parsed.success) return failure('invalidInput');

  const { redemptionId } = parsed.data;

  return getDb().transaction(async (tx): Promise<ActionState> => {
    const updated = await tx
      .update(redemption)
      .set({ status: 'fulfilled', updatedAt: new Date() })
      .where(
        and(
          eq(redemption.id, redemptionId),
          eq(redemption.familyId, principal.familyId),
          // The only legal predecessor (`domain/redemption.ts`): a denied or
          // already-fulfilled row is not re-openable by this path.
          eq(redemption.status, 'approved')
        )
      )
      .returning({ id: redemption.id, memberId: redemption.memberId });

    if (updated.length === 0) return failure('redemptionNotFound');

    await publish(
      {
        familyId: principal.familyId,
        type: 'redemption.decided',
        entity: { id: redemptionId },
        actor: { ...actorOf(principal), source: 'mobile' },
        patch: { status: 'fulfilled', memberId: updated[0].memberId },
      },
      tx
    );

    return idleState;
  });
}
