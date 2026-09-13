import { beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import type { Principal } from '@/modules/family';
import type { McpToolServer } from '@/app/api/mcp/tools/shared';

/**
 * The rewards MCP tools (MCP-parity M3), same fake-server capture as
 * `./routines.test.ts` and `./timers.test.ts`: what is under test is the
 * authorization ladder each handler climbs (scope, then `can()`, then the
 * seam), not the SDK's plumbing. Every seam and query is mocked — no
 * database.
 */

const seams = vi.hoisted(() => ({
  listRewards: vi.fn(),
  getReward: vi.fn(),
  listRedemptions: vi.fn(),
  getStarTotals: vi.fn(),
  listStarTotals: vi.fn(),
  listStarsEarnedSince: vi.fn(),
  listStarHistory: vi.fn(),
  createReward: vi.fn(),
  updateReward: vi.fn(),
  deleteReward: vi.fn(),
  awardStars: vi.fn(),
  requestRedemption: vi.fn(),
  decideRedemption: vi.fn(),
  fulfillRedemption: vi.fn(),
}));

const can = vi.hoisted(() => vi.fn());

vi.mock('@/modules/rewards', () => ({
  ...seams,
  REWARD_CATEGORIES: ['privilege', 'experience', 'treat'] as const,
  REDEMPTION_STATUSES: ['requested', 'approved', 'denied', 'fulfilled'] as const,
  REDEMPTION_DECISIONS: ['approve', 'deny'] as const,
  isRewardIcon: () => true,
}));

// The family barrel re-exports client components; only `can` is reached here.
vi.mock('@/modules/family', () => ({ can }));

const { registerRewardsTools } = await import('@/app/api/mcp/tools/rewards');

const FAMILY_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const REWARD_ID = '33333333-3333-4333-8333-333333333333';
const REDEMPTION_ID = '44444444-4444-4444-8444-444444444444';

const READ = 'kynite:rewards.read';
const WRITE = 'kynite:rewards.write';

const principal: Principal = {
  kind: 'member',
  familyId: FAMILY_ID,
  memberId: MEMBER_ID,
  role: 'adult',
} as Principal;

type Captured = { handler: (input: unknown) => Promise<ToolResult>; config: unknown };
type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

function register(scopes: string[]): Map<string, Captured> {
  const tools = new Map<string, Captured>();
  const server = {
    registerTool: (name: string, config: unknown, handler: Captured['handler']) => {
      tools.set(name, { config, handler });
    },
  } as unknown as McpToolServer;

  registerRewardsTools(server, principal, new Set(scopes));
  return tools;
}

async function call(scopes: string[], name: string, input: unknown = {}) {
  const tool = register(scopes).get(name);
  if (!tool) throw new Error(`tool not registered: ${name}`);
  const result = await tool.handler(input);
  return { isError: result.isError === true, body: JSON.parse(result.content[0].text) };
}

const REWARD_ROW = {
  id: REWARD_ID,
  familyId: FAMILY_ID,
  title: 'Kies het toetje',
  icon: 'icecream',
  imageUrl: null,
  costStars: 5,
  category: 'treat',
  availableToMemberIds: [],
  requiresApproval: true,
  active: true,
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const REDEMPTION_ROW = {
  id: REDEMPTION_ID,
  familyId: FAMILY_ID,
  memberId: MEMBER_ID,
  rewardId: REWARD_ID,
  costStars: 5,
  status: 'requested',
  requestedAt: new Date(0),
  decidedAt: null,
  decidedByMemberId: null,
  createdEventId: null,
  clientId: 'abc-client-id',
  createdAt: new Date(0),
  updatedAt: new Date(0),
  rewardTitle: 'Kies het toetje',
  rewardIcon: 'icecream',
};

beforeEach(() => {
  vi.clearAllMocks();
  can.mockReturnValue(true);
  seams.listStarsEarnedSince.mockResolvedValue(new Map());
});

/** One tool's declared zod input schema, for the cap assertions below. */
function schemaOf(name: string) {
  const tool = register([READ, WRITE]).get(name);
  if (!tool) throw new Error(`tool not registered: ${name}`);
  return (tool.config as { inputSchema: { safeParse: (input: unknown) => { success: boolean } } })
    .inputSchema;
}

describe('tool registration', () => {
  it('registers every rewards tool', () => {
    expect([...register([READ, WRITE]).keys()].sort()).toEqual(
      [
        'award_stars',
        'create_reward',
        'decide_redemption',
        'delete_reward',
        'fulfill_redemption',
        'get_reward',
        'get_star_totals',
        'list_redemptions',
        'list_rewards',
        'list_star_history',
        'request_redemption',
        'update_reward',
      ].sort()
    );
  });
});

describe('list_rewards', () => {
  it('refuses a token without the read scope', async () => {
    const { isError, body } = await call([WRITE], 'list_rewards');

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.listRewards).not.toHaveBeenCalled();
  });

  it('returns rewards without familyId', async () => {
    seams.listRewards.mockResolvedValue([REWARD_ROW]);

    const { isError, body } = await call([READ], 'list_rewards', { activeOnly: true });

    expect(isError).toBe(false);
    expect(seams.listRewards).toHaveBeenCalledWith(FAMILY_ID, {
      memberId: undefined,
      activeOnly: true,
    });
    expect(body).toEqual([
      {
        id: REWARD_ID,
        title: 'Kies het toetje',
        icon: 'icecream',
        costStars: 5,
        category: 'treat',
        availableToMemberIds: [],
        active: true,
      },
    ]);
    expect(JSON.stringify(body)).not.toContain(FAMILY_ID);
  });
});

describe('get_reward', () => {
  it('refuses a token without the read scope', async () => {
    const { isError, body } = await call([], 'get_reward', { rewardId: REWARD_ID });

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
  });

  it('reports an unknown reward as notFound rather than empty', async () => {
    seams.getReward.mockResolvedValue(null);

    const { isError, body } = await call([READ], 'get_reward', { rewardId: REWARD_ID });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'rewardNotFound' });
  });

  it('returns the reward', async () => {
    seams.getReward.mockResolvedValue(REWARD_ROW);

    const { isError, body } = await call([READ], 'get_reward', { rewardId: REWARD_ID });

    expect(isError).toBe(false);
    expect(seams.getReward).toHaveBeenCalledWith(FAMILY_ID, REWARD_ID);
    expect(body.id).toBe(REWARD_ID);
    expect(body.familyId).toBeUndefined();
  });
});

describe('list_redemptions', () => {
  it('refuses a token without the read scope', async () => {
    const { isError, body } = await call([WRITE], 'list_redemptions');

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.listRedemptions).not.toHaveBeenCalled();
  });

  it('returns redemptions without familyId or clientId', async () => {
    seams.listRedemptions.mockResolvedValue([REDEMPTION_ROW]);

    const { isError, body } = await call([READ], 'list_redemptions', {
      memberId: MEMBER_ID,
      status: ['requested'],
      limit: 100,
    });

    expect(isError).toBe(false);
    expect(seams.listRedemptions).toHaveBeenCalledWith(FAMILY_ID, {
      memberId: MEMBER_ID,
      statuses: ['requested'],
      limit: 100,
    });
    expect(body).toEqual([
      {
        id: REDEMPTION_ID,
        memberId: MEMBER_ID,
        rewardId: REWARD_ID,
        costStars: 5,
        status: 'requested',
        requestedAt: REDEMPTION_ROW.requestedAt.toISOString(),
        decidedAt: null,
        decidedByMemberId: null,
        rewardTitle: 'Kies het toetje',
        rewardIcon: 'icecream',
      },
    ]);
    expect(JSON.stringify(body)).not.toContain(FAMILY_ID);
    expect(JSON.stringify(body)).not.toContain('abc-client-id');
  });
});

describe('get_star_totals', () => {
  it('refuses a token without the read scope', async () => {
    const { isError, body } = await call([WRITE], 'get_star_totals');

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.getStarTotals).not.toHaveBeenCalled();
    expect(seams.listStarTotals).not.toHaveBeenCalled();
  });

  it('returns one member’s totals when memberId is given', async () => {
    seams.getStarTotals.mockResolvedValue({ earned: 10, spent: 5, available: 5 });

    const { isError, body } = await call([READ], 'get_star_totals', { memberId: MEMBER_ID });

    expect(isError).toBe(false);
    expect(seams.getStarTotals).toHaveBeenCalledWith(FAMILY_ID, MEMBER_ID);
    expect(seams.listStarTotals).not.toHaveBeenCalled();
    expect(body).toEqual({
      earned: 10,
      spent: 5,
      available: 5,
      earnedLast7Days: 0,
      avgPerDay: 0,
    });
  });

  it('returns the whole family’s totals when memberId is omitted', async () => {
    seams.listStarTotals.mockResolvedValue(
      new Map([[MEMBER_ID, { earned: 10, spent: 5, available: 5 }]])
    );

    const { isError, body } = await call([READ], 'get_star_totals');

    expect(isError).toBe(false);
    expect(seams.listStarTotals).toHaveBeenCalledWith(FAMILY_ID);
    expect(seams.getStarTotals).not.toHaveBeenCalled();
    expect(body).toEqual({
      [MEMBER_ID]: { earned: 10, spent: 5, available: 5, earnedLast7Days: 0, avgPerDay: 0 },
    });
  });

  it('reports the 7-day earning window a reward should be priced against', async () => {
    seams.getStarTotals.mockResolvedValue({ earned: 100, spent: 20, available: 80 });
    seams.listStarsEarnedSince.mockResolvedValue(new Map([[MEMBER_ID, 70]]));

    const { isError, body } = await call([READ], 'get_star_totals', { memberId: MEMBER_ID });

    expect(isError).toBe(false);
    expect(body.earnedLast7Days).toBe(70);
    expect(body.avgPerDay).toBe(10);

    const [args] = seams.listStarsEarnedSince.mock.calls[0] as [{ familyId: string; since: Date }];
    expect(args.familyId).toBe(FAMILY_ID);
    const windowDays = (Date.now() - args.since.getTime()) / 86_400_000;
    expect(windowDays).toBeGreaterThan(6.9);
    expect(windowDays).toBeLessThan(7.1);
  });

  it('rounds avgPerDay to one decimal', async () => {
    seams.getStarTotals.mockResolvedValue({ earned: 5, spent: 0, available: 5 });
    seams.listStarsEarnedSince.mockResolvedValue(new Map([[MEMBER_ID, 5]]));

    const { body } = await call([READ], 'get_star_totals', { memberId: MEMBER_ID });

    expect(body.avgPerDay).toBe(0.7);
  });
});

describe('list_star_history', () => {
  it('refuses a token without the read scope', async () => {
    const { isError, body } = await call([WRITE], 'list_star_history', { memberId: MEMBER_ID });

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.listStarHistory).not.toHaveBeenCalled();
  });

  it('returns the member’s star history', async () => {
    seams.listStarHistory.mockResolvedValue([
      { id: 'e1', amount: 2, reason: 'bonus', note: null, createdAt: new Date(0) },
    ]);

    const { isError, body } = await call([READ], 'list_star_history', {
      memberId: MEMBER_ID,
      limit: 5,
    });

    expect(isError).toBe(false);
    expect(seams.listStarHistory).toHaveBeenCalledWith(FAMILY_ID, MEMBER_ID, 5);
    expect(body).toEqual([
      { id: 'e1', amount: 2, reason: 'bonus', note: null, createdAt: new Date(0).toISOString() },
    ]);
  });
});

describe('create_reward', () => {
  const input = {
    title: 'Kies het toetje',
    icon: 'icecream',
    costStars: 5,
    category: 'treat',
    availableToMemberIds: [],
    active: true,
  };

  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], 'create_reward', input);

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.createReward).not.toHaveBeenCalled();
  });

  it('refuses a principal that cannot manage rewards', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'create_reward', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(can).toHaveBeenCalledWith(principal, 'reward:manage', { familyId: FAMILY_ID });
    expect(seams.createReward).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    seams.createReward.mockResolvedValue({ status: 'error', error: 'invalidInput' });

    const { isError, body } = await call([WRITE], 'create_reward', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'invalidInput' });
  });

  it('calls the seam and reports success', async () => {
    seams.createReward.mockResolvedValue({ status: 'idle' });

    const { isError, body } = await call([WRITE], 'create_reward', input);

    expect(isError).toBe(false);
    expect(seams.createReward).toHaveBeenCalledWith(principal, input);
    expect(body).toEqual({ created: true });
  });
});

describe('update_reward', () => {
  const input = {
    rewardId: REWARD_ID,
    title: 'Kies het toetje',
    icon: 'icecream',
    costStars: 5,
    category: 'treat',
    availableToMemberIds: [],
    active: true,
  };

  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], 'update_reward', input);

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.updateReward).not.toHaveBeenCalled();
  });

  it('refuses a principal that cannot manage rewards', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'update_reward', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(seams.updateReward).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    seams.updateReward.mockResolvedValue({ status: 'error', error: 'rewardNotFound' });

    const { isError, body } = await call([WRITE], 'update_reward', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'rewardNotFound' });
  });

  it('calls the seam and reports success', async () => {
    seams.updateReward.mockResolvedValue({ status: 'idle' });

    const { isError, body } = await call([WRITE], 'update_reward', input);

    expect(isError).toBe(false);
    expect(seams.updateReward).toHaveBeenCalledWith(principal, input);
    expect(body).toEqual({ updated: true });
  });
});

describe('delete_reward', () => {
  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], 'delete_reward', { rewardId: REWARD_ID });

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.deleteReward).not.toHaveBeenCalled();
  });

  it('refuses a principal that cannot manage rewards', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'delete_reward', { rewardId: REWARD_ID });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(seams.deleteReward).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    seams.deleteReward.mockResolvedValue({ status: 'error', error: 'rewardNotFound' });

    const { isError, body } = await call([WRITE], 'delete_reward', { rewardId: REWARD_ID });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'rewardNotFound' });
  });

  it('calls the seam and reports success', async () => {
    seams.deleteReward.mockResolvedValue({ status: 'idle' });

    const { isError, body } = await call([WRITE], 'delete_reward', { rewardId: REWARD_ID });

    expect(isError).toBe(false);
    expect(seams.deleteReward).toHaveBeenCalledWith(principal, { rewardId: REWARD_ID });
    expect(body).toEqual({ deleted: true });
  });
});

describe('award_stars', () => {
  const input = { memberId: MEMBER_ID, amount: 3, reason: 'surprise' as const };

  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], 'award_stars', input);

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.awardStars).not.toHaveBeenCalled();
  });

  it('refuses a principal that cannot award stars', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'award_stars', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(can).toHaveBeenCalledWith(principal, 'stars:award', { familyId: FAMILY_ID });
    expect(seams.awardStars).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    seams.awardStars.mockResolvedValue({ status: 'error', error: 'memberNotFound' });

    const { isError, body } = await call([WRITE], 'award_stars', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'memberNotFound' });
  });

  it('calls the seam and reports success', async () => {
    seams.awardStars.mockResolvedValue({ status: 'idle' });

    const { isError, body } = await call([WRITE], 'award_stars', input);

    expect(isError).toBe(false);
    expect(seams.awardStars).toHaveBeenCalledWith(principal, input);
    expect(body).toEqual({ awarded: true });
  });
});

describe('request_redemption', () => {
  const input = { rewardId: REWARD_ID, memberId: MEMBER_ID, clientId: 'abc-client-id' };

  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], 'request_redemption', input);

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.requestRedemption).not.toHaveBeenCalled();
  });

  it('checks redemption:request against the subject member', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'request_redemption', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(can).toHaveBeenCalledWith(principal, 'redemption:request', {
      familyId: FAMILY_ID,
      memberId: MEMBER_ID,
    });
    expect(seams.requestRedemption).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    seams.requestRedemption.mockResolvedValue({ status: 'error', error: 'notEnoughStars' });

    const { isError, body } = await call([WRITE], 'request_redemption', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'notEnoughStars' });
  });

  it('calls the seam and reports the request', async () => {
    seams.requestRedemption.mockResolvedValue({ status: 'requested', replayed: false });

    const { isError, body } = await call([WRITE], 'request_redemption', input);

    expect(isError).toBe(false);
    expect(seams.requestRedemption).toHaveBeenCalledWith(principal, input);
    expect(body).toEqual({ requested: true, replayed: false });
  });
});

describe('decide_redemption', () => {
  const input = { redemptionId: REDEMPTION_ID, decision: 'approve' as const };

  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], 'decide_redemption', input);

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.decideRedemption).not.toHaveBeenCalled();
  });

  it('refuses a principal that cannot approve redemptions', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'decide_redemption', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(can).toHaveBeenCalledWith(principal, 'redemption:approve', { familyId: FAMILY_ID });
    expect(seams.decideRedemption).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    seams.decideRedemption.mockResolvedValue({ status: 'error', error: 'alreadyDecided' });

    const { isError, body } = await call([WRITE], 'decide_redemption', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'alreadyDecided' });
  });

  it('calls the seam and reports success', async () => {
    seams.decideRedemption.mockResolvedValue({ status: 'idle' });

    const { isError, body } = await call([WRITE], 'decide_redemption', input);

    expect(isError).toBe(false);
    expect(seams.decideRedemption).toHaveBeenCalledWith(principal, input);
    expect(body).toEqual({ decided: true });
  });
});

describe('fulfill_redemption', () => {
  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], 'fulfill_redemption', {
      redemptionId: REDEMPTION_ID,
    });

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.fulfillRedemption).not.toHaveBeenCalled();
  });

  it('refuses a principal that cannot approve redemptions', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'fulfill_redemption', {
      redemptionId: REDEMPTION_ID,
    });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(seams.fulfillRedemption).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    seams.fulfillRedemption.mockResolvedValue({ status: 'error', error: 'redemptionNotFound' });

    const { isError, body } = await call([WRITE], 'fulfill_redemption', {
      redemptionId: REDEMPTION_ID,
    });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'redemptionNotFound' });
  });

  it('calls the seam and reports success', async () => {
    seams.fulfillRedemption.mockResolvedValue({ status: 'idle' });

    const { isError, body } = await call([WRITE], 'fulfill_redemption', {
      redemptionId: REDEMPTION_ID,
    });

    expect(isError).toBe(false);
    expect(seams.fulfillRedemption).toHaveBeenCalledWith(principal, {
      redemptionId: REDEMPTION_ID,
    });
    expect(body).toEqual({ fulfilled: true });
  });
});

/**
 * The MCP layer's own price band, narrower than the seam's. The app's store
 * editor still accepts the wider range; what is capped here is an LLM host's
 * ability to invent an economy the child can never reach.
 */
describe('star economy caps', () => {
  const rewardBody = {
    title: 'Extra voorleesverhaal',
    icon: 'book',
    category: 'privilege',
    costStars: 10,
  };

  it('accepts a reward priced inside the band', () => {
    expect(schemaOf('create_reward').safeParse(rewardBody).success).toBe(true);
  });

  it('refuses a reward priced past 250 stars', () => {
    expect(schemaOf('create_reward').safeParse({ ...rewardBody, costStars: 400 }).success).toBe(
      false
    );
  });

  it('refuses a free reward', () => {
    expect(schemaOf('create_reward').safeParse({ ...rewardBody, costStars: 0 }).success).toBe(
      false
    );
  });

  it('applies the same band to update_reward', () => {
    const body = { ...rewardBody, rewardId: REWARD_ID, costStars: 251 };

    expect(schemaOf('update_reward').safeParse(body).success).toBe(false);
    expect(schemaOf('update_reward').safeParse({ ...body, costStars: 250 }).success).toBe(true);
  });

  it('caps a surprise bonus at 10 stars per call', () => {
    const body = { memberId: MEMBER_ID, reason: 'surprise' };

    expect(schemaOf('award_stars').safeParse({ ...body, amount: 5 }).success).toBe(true);
    expect(schemaOf('award_stars').safeParse({ ...body, amount: 11 }).success).toBe(false);
  });
});
