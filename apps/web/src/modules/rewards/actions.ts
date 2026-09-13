'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/server/db';
// Table objects come from the schema assembly point, not from a slice barrel
// (see the same note in `modules/routines/actions.ts`): a barrel re-exports
// client components, which must not enter a server mutation module.
import { reward } from '@/server/db/schema';
import { assertCan } from '@/modules/family';
import {
  awardStars,
  createReward,
  decideRedemption,
  deleteReward,
  fulfillRedemption,
  requestRedemption,
  updateReward,
  type AwardStarsInput,
  type DecideRedemptionInput,
  type FulfillRedemptionInput,
  type RequestRedemptionInput,
  type RewardInput,
  type UpdateRewardInput,
} from './write';
import {
  actionFailure as failure,
  idleState,
  type ActionState,
  type RedemptionState,
} from './action-state';
import { isRewardIcon } from './ui/tokens';
import { REWARD_CATEGORIES } from './schema';

/**
 * Mutations for the rewards slice (M08; write seams extracted at MCP
 * milestone M3).
 *
 * Same §2 discipline as every other slice: `assertCan()` is the first
 * statement in every action — before any database identifier is
 * referenced — which is what `tests/unit/server-action-authorization.test.ts`
 * audits structurally. This is a cheap early rejection, not the decision:
 * each write seam (`./write.ts`) re-checks `can()` against the resolved
 * principal itself, so `/api/mcp`'s tools reach identical authorization
 * without going through `assertCan`'s cookie/session resolution.
 *
 * The hard invariant this file always carried is now enforced inside
 * `./write.ts` instead: nothing writes a negative star, and nothing updates
 * or deletes a `star_ledger` row —
 * `tests/unit/append-only-star-ledger.test.ts` still scans this repo for the
 * mutations that would bypass it.
 *
 * `seedRewardPresetsAction` stayed here rather than moving into `./write.ts`:
 * it is UI-only onboarding an MCP client has no use for (M3's brief), so it
 * is the one action in this file that is not a thin wrapper.
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
 * Every surface that renders stars or rewards.
 *
 * No SSE yet (M10 owns realtime), so revalidation is the mechanism.
 * `publish()` is already called inside each write seam, so when the stream
 * lands these paths become a fallback rather than a second call site to
 * retrofit.
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

function rewardInput(formData: FormData): RewardInput {
  return {
    title: read(formData, 'title'),
    icon: read(formData, 'icon'),
    costStars: readNumber(formData, 'costStars', 1),
    category: read(formData, 'category') as RewardInput['category'],
    availableToMemberIds: readAll(formData, 'availableToMemberIds').filter((id) => id !== ''),
    active: formData.get('active') !== null,
  };
}

export async function createRewardAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('reward:manage').catch(() => null);
  if (!principal) return failure('forbidden');

  const result = await createReward(principal, rewardInput(formData));
  await revalidateRewards();
  return result;
}

export async function updateRewardAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('reward:manage').catch(() => null);
  if (!principal) return failure('forbidden');

  const rewardId = read(formData, 'rewardId');
  const input: UpdateRewardInput = { ...rewardInput(formData), rewardId };

  const result = await updateReward(principal, input);
  await revalidateRewards();
  return result;
}

export async function deleteRewardAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('reward:manage').catch(() => null);
  if (!principal) return failure('forbidden');

  const result = await deleteReward(principal, { rewardId: read(formData, 'rewardId') });
  await revalidateRewards();
  return result;
}

/* -------------------------------------------------------------------------- */
/* stars                                                                      */
/* -------------------------------------------------------------------------- */

export async function awardStarsAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('stars:award').catch(() => null);
  if (!principal) return failure('forbidden');

  const input: AwardStarsInput = {
    memberId: read(formData, 'memberId'),
    amount: readNumber(formData, 'amount', 1),
    reason: (read(formData, 'reason') || 'surprise') as AwardStarsInput['reason'],
    note: read(formData, 'note') || undefined,
  };

  const result = await awardStars(principal, input);
  await revalidateRewards([input.memberId]);
  return result;
}

/* -------------------------------------------------------------------------- */
/* redemption                                                                 */
/* -------------------------------------------------------------------------- */

export type { RequestRedemptionInput } from './write';

/**
 * A child asks for a reward from the hub (FR16). Kept as a plain async
 * function (not a `<state, formData>` action) since it is called directly
 * from client code with a typed payload, same as before the M3 extraction.
 */
export async function requestRedemptionAction(
  input: RequestRedemptionInput
): Promise<RedemptionState> {
  const principal = await assertCan('redemption:request', { memberId: input.memberId }).catch(
    () => null
  );
  if (!principal) return { status: 'error', error: 'forbidden' };

  const result = await requestRedemption(principal, input);
  await revalidateRewards([input.memberId]);
  return result;
}

export async function decideRedemptionAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('redemption:approve').catch(() => null);
  if (!principal) return failure('forbidden');

  const input: DecideRedemptionInput = {
    redemptionId: read(formData, 'redemptionId'),
    decision: read(formData, 'decision') as DecideRedemptionInput['decision'],
  };

  const result = await decideRedemption(principal, input);
  await revalidateRewards();
  return result;
}

export async function fulfillRedemptionAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('redemption:approve').catch(() => null);
  if (!principal) return failure('forbidden');

  const input: FulfillRedemptionInput = { redemptionId: read(formData, 'redemptionId') };

  const result = await fulfillRedemption(principal, input);
  await revalidateRewards();
  return result;
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
 * UI-only onboarding, deliberately not extracted into `./write.ts` — see the
 * module doc comment. The titles arrive already translated from the client,
 * because the preset list is a *starting point a parent then edits* — storing
 * translation keys would mean an edited reward and a pristine one are
 * different kinds of row. The costs and categories are still validated
 * server-side against the same schema a hand-typed reward goes through, so a
 * tampered form cannot smuggle in a category the enum does not have.
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
