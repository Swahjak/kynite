import 'server-only';
import { z } from 'zod';
import { MCP_REWARDS_READ, MCP_REWARDS_WRITE, hasAllScopes } from '@/server/mcp-auth';
import { can, type Principal } from '@/modules/family';
import {
  REWARD_CATEGORIES,
  REDEMPTION_DECISIONS,
  REDEMPTION_STATUSES,
  awardStars,
  createReward,
  decideRedemption,
  deleteReward,
  fulfillRedemption,
  getReward,
  getStarTotals,
  isRewardIcon,
  listRedemptions,
  listRewards,
  listStarHistory,
  listStarTotals,
  listStarsEarnedSince,
  requestRedemption,
  updateReward,
  type Redemption,
  type RedemptionWithReward,
  type Reward,
  type StarEntry,
  type StarTotals,
} from '@/modules/rewards';
import { ok, toolError, type McpToolServer } from './shared';

/**
 * The rewards domain's MCP tools (MCP-parity M3) — the catalogue, the star
 * ledger and the approval queue.
 *
 * Same discipline as `./routines.ts` and `./timers.ts`: every write goes
 * through `modules/rewards/write.ts`, never through a Server Action, and each
 * mutating tool re-checks `can()` itself before calling the seam —
 * deliberately redundant with the seam's own check. `seedRewardPresetsAction`
 * has no tool: it is UI-only onboarding, per the milestone brief.
 */

const SCOPE_READ = 'insufficientScope: requires kynite:rewards.read';
const SCOPE_WRITE = 'insufficientScope: requires kynite:rewards.write';

/** The calibration window `get_star_totals` reports against. */
const EARNING_WINDOW_DAYS = 7;

/**
 * The price band, narrower here than the seam's 1–500.
 *
 * A store only works if it is priced against what the child actually earns: at
 * roughly ten stars a day, 3–10 is the same-day treat, 20–50 the few-day
 * saving, 100–250 the multi-week goal. Anything past 250 is a horizon no child
 * in this age range can hold, so the MCP layer refuses it rather than letting a
 * host invent a 400-star bicycle. The app's own store editor keeps the wider
 * range.
 */
const costStarsSchema = z
  .number()
  .int()
  .min(1)
  .max(250)
  .describe(
    'Price relative to what this child earns per day (see `get_star_totals`): small 3–10, medium 20–50, big 100–250.'
  );

/** A reward as an MCP client sees it: no `familyId`. */
function rewardView(row: Reward) {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    costStars: row.costStars,
    category: row.category,
    availableToMemberIds: row.availableToMemberIds,
    active: row.active,
  };
}

/** A redemption as an MCP client sees it: no `familyId`, no `clientId`. */
function redemptionView(row: RedemptionWithReward | Redemption) {
  return {
    id: row.id,
    memberId: row.memberId,
    rewardId: row.rewardId,
    costStars: row.costStars,
    status: row.status,
    requestedAt: row.requestedAt,
    decidedAt: row.decidedAt,
    decidedByMemberId: row.decidedByMemberId,
    ...('rewardTitle' in row ? { rewardTitle: row.rewardTitle, rewardIcon: row.rewardIcon } : {}),
  };
}

/** The instant `days` ago — the left edge of the calibration window. */
function windowStart(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Totals, plus the two numbers a host needs to price anything.
 *
 * A star total alone says nothing about what a reward should cost: 40 stars is
 * a fortnight for one child and three days for another. `avgPerDay` over the
 * last week is the exchange rate, and it is deliberately returned alongside the
 * totals rather than left for the host to compute from `list_star_history`,
 * which caps at 100 entries and would give a silently wrong answer for a busy
 * family.
 */
function withEarningRate(totals: StarTotals, earnedInWindow: number) {
  return {
    ...totals,
    earnedLast7Days: earnedInWindow,
    avgPerDay: Math.round((earnedInWindow / EARNING_WINDOW_DAYS) * 10) / 10,
  };
}

function starEntryView(row: StarEntry) {
  return {
    id: row.id,
    amount: row.amount,
    reason: row.reason,
    note: row.note,
    createdAt: row.createdAt,
  };
}

export function registerRewardsTools(
  server: McpToolServer,
  principal: Principal,
  grantedScopes: ReadonlySet<string>
): void {
  server.registerTool(
    'list_rewards',
    {
      title: 'List rewards',
      description:
        'List this family’s reward catalogue, optionally narrowed to one member’s shelf or to only the active rewards. Read it before adding a reward, so the price ladder stays coherent.',
      inputSchema: z.object({
        memberId: z.uuid().optional().describe('Only rewards available to this member.'),
        activeOnly: z.boolean().optional().describe('Skip inactive rewards.'),
      }),
    },
    async ({ memberId, activeOnly }) => {
      if (!hasAllScopes(grantedScopes, [MCP_REWARDS_READ])) return toolError(SCOPE_READ);

      const rewards = await listRewards(principal.familyId, { memberId, activeOnly });
      return ok(rewards.map(rewardView));
    }
  );

  server.registerTool(
    'get_reward',
    {
      title: 'Get one reward',
      description: 'One reward. Unknown or other-family ids return notFound.',
      inputSchema: z.object({ rewardId: z.uuid() }),
    },
    async ({ rewardId }) => {
      if (!hasAllScopes(grantedScopes, [MCP_REWARDS_READ])) return toolError(SCOPE_READ);

      const row = await getReward(principal.familyId, rewardId);
      if (!row) return toolError('rewardNotFound');

      return ok(rewardView(row));
    }
  );

  server.registerTool(
    'list_redemptions',
    {
      title: 'List redemptions',
      description:
        'List this family’s redemption requests, newest first, optionally narrowed to one member or one or more statuses.',
      inputSchema: z.object({
        memberId: z.uuid().optional(),
        status: z
          .array(z.enum(REDEMPTION_STATUSES))
          .optional()
          .describe('Defaults to every status.'),
        limit: z.number().int().min(1).max(100).default(100),
      }),
    },
    async ({ memberId, status, limit }) => {
      if (!hasAllScopes(grantedScopes, [MCP_REWARDS_READ])) return toolError(SCOPE_READ);

      const rows = await listRedemptions(principal.familyId, { memberId, statuses: status, limit });
      return ok(rows.map(redemptionView));
    }
  );

  server.registerTool(
    'get_star_totals',
    {
      title: 'Get star totals',
      description:
        'Star totals (earned, spent, available) plus `earnedLast7Days` and `avgPerDay`. `avgPerDay` is the number to price a reward or a star rate against — call this before either.',
      inputSchema: z.object({
        memberId: z.uuid().optional().describe('One member; omit for every member of the family.'),
      }),
    },
    async ({ memberId }) => {
      if (!hasAllScopes(grantedScopes, [MCP_REWARDS_READ])) return toolError(SCOPE_READ);

      // One family-wide scan for the window, whichever branch runs: the query
      // is indexed on `(familyId, memberId, createdAt)` and a week of one
      // household's ledger is a handful of rows, so narrowing it per member
      // would cost a round trip to save nothing.
      const earned = await listStarsEarnedSince({
        familyId: principal.familyId,
        since: windowStart(EARNING_WINDOW_DAYS),
      });

      if (memberId) {
        const totals = await getStarTotals(principal.familyId, memberId);
        return ok(withEarningRate(totals, earned.get(memberId) ?? 0));
      }

      const totals = await listStarTotals(principal.familyId);
      return ok(
        Object.fromEntries(
          [...totals].map(([id, row]) => [id, withEarningRate(row, earned.get(id) ?? 0)])
        )
      );
    }
  );

  server.registerTool(
    'list_star_history',
    {
      title: 'List star history',
      description:
        'One member’s recent star-ledger entries, newest first. The ledger is append-only — there is no debit row here and never will be.',
      inputSchema: z.object({
        memberId: z.uuid(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    },
    async ({ memberId, limit }) => {
      if (!hasAllScopes(grantedScopes, [MCP_REWARDS_READ])) return toolError(SCOPE_READ);

      const rows = await listStarHistory(principal.familyId, memberId, limit);
      return ok(rows.map(starEntryView));
    }
  );

  server.registerTool(
    'create_reward',
    {
      title: 'Create a reward',
      description:
        'Add a reward to the family’s catalogue. Price it against the child’s daily earning (small 3–10, medium 20–50, big 100–250) and keep it a privilege or an experience — never money or allowance.',
      inputSchema: z.object({
        title: z.string().min(1).max(120),
        icon: z.string().refine(isRewardIcon),
        costStars: costStarsSchema,
        category: z.enum(REWARD_CATEGORIES),
        availableToMemberIds: z
          .array(z.uuid())
          .default([])
          .describe('Empty = available to every child.'),
        active: z.boolean().default(true),
      }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_REWARDS_WRITE])) return toolError(SCOPE_WRITE);
      if (!can(principal, 'reward:manage', { familyId: principal.familyId })) {
        return toolError('forbidden');
      }

      const result = await createReward(principal, input);
      if (result.status === 'error') return toolError(result.error);
      return ok({ created: true });
    }
  );

  server.registerTool(
    'update_reward',
    {
      title: 'Update a reward',
      description:
        'Replace a reward’s whole body; re-pricing never re-prices a request already in flight. Raising a price a child is already saving toward is a broken promise — confirm with the parent first.',
      inputSchema: z.object({
        rewardId: z.uuid(),
        title: z.string().min(1).max(120),
        icon: z.string().refine(isRewardIcon),
        costStars: costStarsSchema,
        category: z.enum(REWARD_CATEGORIES),
        availableToMemberIds: z.array(z.uuid()).default([]),
        active: z.boolean().default(true),
      }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_REWARDS_WRITE])) return toolError(SCOPE_WRITE);
      if (!can(principal, 'reward:manage', { familyId: principal.familyId })) {
        return toolError('forbidden');
      }

      const result = await updateReward(principal, input);
      if (result.status === 'error') return toolError(result.error);
      return ok({ updated: true });
    }
  );

  server.registerTool(
    'delete_reward',
    {
      title: 'Delete a reward',
      description:
        'Delete a reward and its redemption history. The star ledger is append-only, so every star already earned survives — but a child saving toward this reward loses the goal, so confirm with the parent.',
      inputSchema: z.object({ rewardId: z.uuid() }),
    },
    async ({ rewardId }) => {
      if (!hasAllScopes(grantedScopes, [MCP_REWARDS_WRITE])) return toolError(SCOPE_WRITE);
      if (!can(principal, 'reward:manage', { familyId: principal.familyId })) {
        return toolError('forbidden');
      }

      const result = await deleteReward(principal, { rewardId });
      if (result.status === 'error') return toolError(result.error);
      return ok({ deleted: true });
    }
  );

  server.registerTool(
    'award_stars',
    {
      title: 'Award stars',
      description:
        'Give a member a small surprise bonus (1–5) for effort they actually showed, naming the behaviour in `note`. Never announce a bonus in advance — a promised reward is a bribe and undermines the motivation it buys.',
      inputSchema: z.object({
        memberId: z.uuid(),
        amount: z
          .number()
          .int()
          .min(1)
          .max(10)
          .describe(
            'A surprise bonus is small: 1–5. A bonus large enough to bargain over stops being a surprise and starts being a wage.'
          ),
        reason: z
          .enum(['bonus', 'manual', 'surprise'])
          .describe(
            '"surprise" for effort noticed after the fact (the default choice), "bonus" for an agreed extra, "manual" for a parent correction.'
          ),
        note: z
          .string()
          .max(200)
          .optional()
          .describe('Name the behaviour, not the child — "kept going when the box was heavy".'),
      }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_REWARDS_WRITE])) return toolError(SCOPE_WRITE);
      if (!can(principal, 'stars:award', { familyId: principal.familyId })) {
        return toolError('forbidden');
      }

      const result = await awardStars(principal, input);
      if (result.status === 'error') return toolError(result.error);
      return ok({ awarded: true });
    }
  );

  server.registerTool(
    'request_redemption',
    {
      title: 'Request a redemption',
      description:
        'Ask for a reward on behalf of a member. No stars move here — a request is a question, and only approval spends. Idempotent by `clientId`.',
      inputSchema: z.object({
        rewardId: z.uuid(),
        memberId: z.uuid(),
        clientId: z
          .string()
          .min(8)
          .max(200)
          .describe('Idempotency key. Reuse the same value when retrying the same request.'),
      }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_REWARDS_WRITE])) return toolError(SCOPE_WRITE);
      if (
        !can(principal, 'redemption:request', {
          familyId: principal.familyId,
          memberId: input.memberId,
        })
      ) {
        return toolError('forbidden');
      }

      const result = await requestRedemption(principal, input);
      if (result.status === 'error') return toolError(result.error);
      return ok({ requested: true, replayed: result.replayed });
    }
  );

  server.registerTool(
    'decide_redemption',
    {
      title: 'Approve or deny a redemption',
      description:
        'Decide an open redemption request. Approving spends the stars; denying is perfectly fine and costs the child nothing — never remove stars, and never frame a denial as a punishment.',
      inputSchema: z.object({
        redemptionId: z.uuid(),
        decision: z.enum(REDEMPTION_DECISIONS),
      }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_REWARDS_WRITE])) return toolError(SCOPE_WRITE);
      if (!can(principal, 'redemption:approve', { familyId: principal.familyId })) {
        return toolError('forbidden');
      }

      const result = await decideRedemption(principal, input);
      if (result.status === 'error') return toolError(result.error);
      return ok({ decided: true });
    }
  );

  server.registerTool(
    'fulfill_redemption',
    {
      title: 'Mark a redemption fulfilled',
      description:
        '"Handed over" — an approved redemption becomes fulfilled. Moves no stars; the spend already happened at approval.',
      inputSchema: z.object({ redemptionId: z.uuid() }),
    },
    async ({ redemptionId }) => {
      if (!hasAllScopes(grantedScopes, [MCP_REWARDS_WRITE])) return toolError(SCOPE_WRITE);
      if (!can(principal, 'redemption:approve', { familyId: principal.familyId })) {
        return toolError('forbidden');
      }

      const result = await fulfillRedemption(principal, { redemptionId });
      if (result.status === 'error') return toolError(result.error);
      return ok({ fulfilled: true });
    }
  );
}
