'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/server/db';
// Table objects come from the schema assembly point, not from a slice barrel
// (see the same note in `modules/routines/actions.ts`): a barrel re-exports
// client components, which must not enter a server mutation module.
import { member, memberStarBalance, redemption, reward, starLedger } from '@/server/db/schema';
import { assertCan, getMember, type Principal } from '@/modules/family';
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
 * Mutations for the rewards slice (M08).
 *
 * Same §2 discipline as every other slice: `assertCan()` is the first statement
 * in every action — before any database identifier is referenced — which is
 * what `tests/unit/server-action-authorization.test.ts` audits structurally.
 * Family scoping never comes from the form: every `where` carries `familyId`
 * from the *principal*, so a forged id addresses nothing.
 *
 * One rule governs the whole file and is worth stating once: **nothing here
 * writes a negative star, and nothing here updates or deletes a `star_ledger`
 * row.** Spending is a `redemption` row whose cost the balance view subtracts;
 * denial writes a status and touches no ledger at all. The database's
 * `CHECK (amount > 0)` is the backstop, and
 * `tests/unit/append-only-star-ledger.test.ts` scans this repo for the
 * mutations that would bypass it.
 */

const trimmed = z.string().trim();

/* -------------------------------------------------------------------------- */
/* shared helpers                                                             */
/* -------------------------------------------------------------------------- */

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function readAll(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((value): value is string => typeof value === 'string');
}

function readNumber(formData: FormData, key: string, fallback: number): number {
  const parsed = Number.parseInt(read(formData, key), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * The realtime `actor` for a principal. A `member` principal names itself; a
 * paired kiosk names its device (M12). Neither is invented from a form.
 */
function actorOf(principal: Principal): { memberId?: string; deviceId?: string } {
  if (principal.kind === 'member') return { memberId: principal.memberId };
  if (principal.kind === 'device') return { deviceId: principal.deviceId };
  return {};
}

/**
 * Every surface that renders stars or rewards.
 *
 * No SSE yet (M10 owns realtime), so revalidation is the mechanism. `publish()`
 * is already called inside each transaction below, so when the stream lands
 * these paths become a fallback rather than a second call site to retrofit.
 */
async function revalidateRewards(memberIds: readonly string[] = []): Promise<void> {
  const locale = await getLocale();
  revalidatePath(`/${locale}/rewards`);
  revalidatePath(`/${locale}/hub/store`);
  for (const memberId of new Set(memberIds)) {
    revalidatePath(`/${locale}/hub/stars/${memberId}`);
  }
}

/* -------------------------------------------------------------------------- */
/* catalogue                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The catalogue form's shape.
 *
 * `category` is `z.enum(REWARD_CATEGORIES)` — the *database* enum, not a
 * hand-written list. There is no money/allowance option to leave out, because
 * the enum has three members and this parser is derived from it: adding one
 * would take a migration, and `tests/unit/rewards/economy.test.ts` asserts the
 * set stays `privilege | experience | treat` (research §Decisions 8, FR16).
 */
const rewardSchema = z.object({
  title: trimmed.min(1).max(120),
  icon: trimmed.refine(isRewardIcon),
  costStars: z.number().int().min(1).max(500),
  category: z.enum(REWARD_CATEGORIES),
  /** Empty = every child in the family. */
  availableToMemberIds: z.array(z.uuid()),
  active: z.boolean(),
});

function rewardInput(formData: FormData) {
  return rewardSchema.safeParse({
    title: read(formData, 'title'),
    icon: read(formData, 'icon'),
    costStars: readNumber(formData, 'costStars', 1),
    category: read(formData, 'category'),
    availableToMemberIds: readAll(formData, 'availableToMemberIds').filter((id) => id !== ''),
    active: formData.get('active') !== null,
  });
}

/** Every restricted-to member must actually be in this family. */
async function membersExist(familyId: string, memberIds: readonly string[]): Promise<boolean> {
  for (const memberId of memberIds) {
    if (!(await getMember(familyId, memberId))) return false;
  }
  return true;
}

export async function createRewardAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('reward:manage').catch(() => null);
  if (!principal) return failure('forbidden');

  const parsed = rewardInput(formData);
  if (!parsed.success) return failure('invalidInput');

  const input = parsed.data;
  if (!(await membersExist(principal.familyId, input.availableToMemberIds))) {
    return failure('memberNotFound');
  }

  await getDb().insert(reward).values({
    familyId: principal.familyId,
    title: input.title,
    icon: input.icon,
    costStars: input.costStars,
    category: input.category,
    availableToMemberIds: input.availableToMemberIds,
    active: input.active,
  });

  await revalidateRewards();
  return idleState;
}

export async function updateRewardAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('reward:manage').catch(() => null);
  if (!principal) return failure('forbidden');

  const rewardId = read(formData, 'rewardId');
  if (!z.uuid().safeParse(rewardId).success) return failure('invalidInput');

  const parsed = rewardInput(formData);
  if (!parsed.success) return failure('invalidInput');

  const input = parsed.data;
  if (!(await membersExist(principal.familyId, input.availableToMemberIds))) {
    return failure('memberNotFound');
  }

  const updated = await getDb()
    .update(reward)
    .set({
      title: input.title,
      icon: input.icon,
      // Re-pricing the shelf never re-prices a request already in flight:
      // `redemption.costStars` was frozen when the child asked.
      costStars: input.costStars,
      category: input.category,
      availableToMemberIds: input.availableToMemberIds,
      active: input.active,
      updatedAt: new Date(),
    })
    .where(and(eq(reward.id, rewardId), eq(reward.familyId, principal.familyId)))
    .returning({ id: reward.id });

  if (updated.length === 0) return failure('rewardNotFound');

  await revalidateRewards();
  return idleState;
}

export async function deleteRewardAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('reward:manage').catch(() => null);
  if (!principal) return failure('forbidden');

  const rewardId = read(formData, 'rewardId');
  if (!z.uuid().safeParse(rewardId).success) return failure('invalidInput');

  // Removing a reward cascades its redemption history away with it — and, by
  // construction, does not touch `star_ledger`: a redemption's cost stops being
  // subtracted, so *available* stars can only go up. Earned stars are
  // untouched either way, which is the invariant that matters.
  const deleted = await getDb()
    .delete(reward)
    .where(and(eq(reward.id, rewardId), eq(reward.familyId, principal.familyId)))
    .returning({ id: reward.id });

  if (deleted.length === 0) return failure('rewardNotFound');

  await revalidateRewards();
  return idleState;
}

/* -------------------------------------------------------------------------- */
/* stars                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A manual or surprise award.
 *
 * `surprise` is the reason the research asks parents to reach for most
 * (§Overjustification: unexpected rewards do not undermine intrinsic
 * motivation, while bigger *expected* payouts do), so it is the form's default
 * — the cheapest way to make the recommended thing the easy thing.
 *
 * `amount` starts at 1: there is no zero award (the `CHECK` would reject it)
 * and no negative one (the `CHECK` would reject that too, and `stars:remove` is
 * `deny` in every column of the §7 matrix besides).
 */
const awardSchema = z.object({
  memberId: z.uuid(),
  amount: z.number().int().min(1).max(20),
  reason: z.enum(['bonus', 'manual', 'surprise']),
  note: trimmed.max(200).optional(),
});

export async function awardStarsAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('stars:award').catch(() => null);
  if (!principal) return failure('forbidden');

  const parsed = awardSchema.safeParse({
    memberId: read(formData, 'memberId'),
    amount: readNumber(formData, 'amount', 1),
    reason: read(formData, 'reason') || 'surprise',
    note: read(formData, 'note') || undefined,
  });
  if (!parsed.success) return failure('invalidInput');

  const { memberId, amount, reason, note } = parsed.data;

  // A uuid from a form. `getMember` returns null for an id that exists but
  // belongs to another family — a forged id addresses nothing.
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

  await revalidateRewards([memberId]);
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
   * `domain/redemption.redemptionSeed` — so a retry after a dropped connection
   * reuses the same key by construction rather than by remembering to.
   */
  clientId: trimmed.min(8).max(200),
});

export type RequestRedemptionInput = z.infer<typeof requestSchema>;

/**
 * A child asks for a reward from the hub (FR16).
 *
 * The write is a single insert with `ON CONFLICT DO NOTHING`, absorbing both
 * unique indexes at once: `unique(clientId)` (a retry or an offline replay) and
 * the partial `unique(memberId, rewardId) where status = 'requested'` (a double
 * tap, or a second tap from a second device that minted its own key). When
 * nothing was inserted, nothing changed — a second request cannot exist, and
 * the tile the child is looking at already says "asked".
 *
 * **No stars move here.** A request is a question; only approval spends.
 */
export async function requestRedemptionAction(
  input: RequestRedemptionInput
): Promise<RedemptionState> {
  const principal = await assertCan('redemption:request', { memberId: input.memberId }).catch(
    () => null
  );
  if (!principal) return redemptionFailure('forbidden');

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

  // §6 step 4: "Redemption requests fan out to all adults" — one `push:send`
  // job per endpoint (§8), so a parent's dead phone blocks nobody else's.
  //
  // Never awaited into the child's critical path in any meaningful sense: it
  // is after the commit, and a failure is swallowed. A queue outage must not
  // turn "may I spend my stars" into an error on a hub, and the request is
  // already on every screen through `publish()`.
  if (requestedId) {
    await notifyRedemption({
      familyId: principal.familyId,
      redemptionId: requestedId,
      childName: child.displayName,
      rewardTitle: target.title,
    }).catch(() => 0);
  }

  await revalidateRewards([memberId]);
  return result;
}

const decideSchema = z.object({
  redemptionId: z.uuid(),
  decision: z.enum(REDEMPTION_DECISIONS),
});

/**
 * A parent approves or denies an open request (FR16, §7 `redemption:approve`).
 *
 * The two outcomes are deliberately asymmetric in what they touch:
 *
 * - **approve** flips the status to `approved`, and *that is the whole
 *   deduction*. `member_star_balance` subtracts the cost of `approved` and
 *   `fulfilled` rows, so there is no second write to keep consistent and no
 *   opportunity for the ledger and the balance to disagree.
 * - **deny** flips the status to `denied` and writes nothing else. The balance
 *   view ignores denied rows, so the child's stars are exactly what they were
 *   a moment earlier. There is no penalty, no note, no ledger entry, and the
 *   hub shows no failure state — `tests/integration/redemption.test.ts` proves
 *   the balance is byte-for-byte unchanged.
 *
 * The row is locked `for update` and re-checked inside the transaction. That
 * alone is not enough on the approve path: two parents approving two
 * *different* requests for the same child lock two different redemption rows,
 * so both can pass the affordability check against `member_star_balance`
 * before either commits — the double-spend the balance view exists to
 * prevent. So approval also locks the *member* row before reading the
 * balance: the second transaction blocks there until the first commits its
 * status update, and only then re-reads a balance that already reflects it.
 */
export async function decideRedemptionAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('redemption:approve').catch(() => null);
  if (!principal) return failure('forbidden');

  const parsed = decideSchema.safeParse({
    redemptionId: read(formData, 'redemptionId'),
    decision: read(formData, 'decision'),
  });
  if (!parsed.success) return failure('invalidInput');

  const { redemptionId, decision } = parsed.data;
  const nextStatus = statusForDecision(decision);

  const outcome = await getDb().transaction(async (tx): Promise<ActionState> => {
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

  await revalidateRewards();
  return outcome;
}

const fulfillSchema = z.object({ redemptionId: z.uuid() });

/**
 * "Handed over" — `approved` becomes `fulfilled`.
 *
 * Both states spend, so this moves no stars; it is bookkeeping that tells the
 * approval queue which granted rewards are still outstanding. Kept separate
 * from approval because the two happen at different times: a zoo trip is
 * approved on Tuesday and fulfilled on Saturday.
 */
export async function fulfillRedemptionAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('redemption:approve').catch(() => null);
  if (!principal) return failure('forbidden');

  const parsed = fulfillSchema.safeParse({ redemptionId: read(formData, 'redemptionId') });
  if (!parsed.success) return failure('invalidInput');

  const { redemptionId } = parsed.data;

  const outcome = await getDb().transaction(async (tx): Promise<ActionState> => {
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

  await revalidateRewards();
  return outcome;
}

/* -------------------------------------------------------------------------- */
/* seeding the shelf                                                          */
/* -------------------------------------------------------------------------- */

const presetSchema = z.object({
  title: trimmed.min(1).max(120),
  icon: trimmed.refine(isRewardIcon),
  costStars: z.number().int().min(1).max(500),
  category: z.enum(REWARD_CATEGORIES),
});

/**
 * Fill an empty catalogue from the presets (research §Decisions 8).
 *
 * The titles arrive already translated from the client, because the preset list
 * is a *starting point a parent then edits* — storing translation keys would
 * mean an edited reward and a pristine one are different kinds of row. The
 * costs and categories are still validated server-side against the same schema
 * a hand-typed reward goes through, so a tampered form cannot smuggle in a
 * category the enum does not have.
 */
export async function seedRewardPresetsAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('reward:manage').catch(() => null);
  if (!principal) return failure('forbidden');

  const titles = readAll(formData, 'presetTitle');
  const icons = readAll(formData, 'presetIcon');
  const costs = readAll(formData, 'presetCost');
  const categories = readAll(formData, 'presetCategory');

  const parsed = titles.map((title, index) =>
    presetSchema.safeParse({
      title,
      icon: icons[index] ?? '',
      costStars: Number.parseInt(costs[index] ?? '', 10),
      category: categories[index] ?? '',
    })
  );

  if (parsed.length === 0 || parsed.some((entry) => !entry.success)) return failure('invalidInput');

  const rows = parsed.flatMap((entry) => (entry.success ? [entry.data] : []));

  const db = getDb();

  const existing = await db
    .select({ id: reward.id })
    .from(reward)
    .where(eq(reward.familyId, principal.familyId))
    .limit(1);

  // Idempotent by precondition: seeding a shelf that already has something on
  // it would duplicate a parent's edits, so it simply does nothing.
  if (existing.length > 0) return idleState;

  await db.insert(reward).values(
    rows.map((row, index) => ({
      familyId: principal.familyId,
      title: row.title,
      icon: row.icon,
      costStars: row.costStars,
      category: row.category,
      sortOrder: index,
    }))
  );

  await revalidateRewards();
  return idleState;
}
