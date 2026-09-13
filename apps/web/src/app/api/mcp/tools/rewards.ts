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
  requestRedemption,
  updateReward,
  type Redemption,
  type RedemptionWithReward,
  type Reward,
  type StarEntry,
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
        'List this family’s reward catalogue, optionally narrowed to one member’s shelf or to only the active rewards.',
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
        'Star totals (earned, spent, available). Pass `memberId` for one member, or omit it for the whole family.',
      inputSchema: z.object({ memberId: z.uuid().optional() }),
    },
    async ({ memberId }) => {
      if (!hasAllScopes(grantedScopes, [MCP_REWARDS_READ])) return toolError(SCOPE_READ);

      if (memberId) {
        return ok(await getStarTotals(principal.familyId, memberId));
      }

      const totals = await listStarTotals(principal.familyId);
      return ok(Object.fromEntries(totals));
    }
  );

  server.registerTool(
    'list_star_history',
    {
      title: 'List star history',
      description:
        'One member’s recent star-ledger entries, newest first. The ledger is append-only.',
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
      description: 'Add a reward to the family’s catalogue.',
      inputSchema: z.object({
        title: z.string().min(1).max(120),
        icon: z.string().refine(isRewardIcon),
        costStars: z.number().int().min(1).max(500),
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
        'Replace a reward’s whole body. Re-pricing never re-prices a request already in flight.',
      inputSchema: z.object({
        rewardId: z.uuid(),
        title: z.string().min(1).max(120),
        icon: z.string().refine(isRewardIcon),
        costStars: z.number().int().min(1).max(500),
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
        'Delete a reward and its redemption history. The star ledger is append-only and keeps every star already earned.',
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
        'Give a member a manual or surprise star award, recorded on the append-only ledger.',
      inputSchema: z.object({
        memberId: z.uuid(),
        amount: z.number().int().min(1).max(20),
        reason: z.enum(['bonus', 'manual', 'surprise']),
        note: z.string().max(200).optional(),
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
        'Ask for a reward on behalf of a member. No stars move here — a request is a question; only approval spends. Idempotent by `clientId`.',
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
        'Decide an open redemption request. Approving is the whole deduction — the balance view subtracts approved and fulfilled requests. Denying costs nothing.',
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
      description: '"Handed over" — an approved redemption becomes fulfilled. Moves no stars.',
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
