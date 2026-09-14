import { beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import type { Principal } from '@/modules/family';
import type { McpToolServer } from '@/app/api/mcp/tools/shared';

/**
 * The family MCP tools (MCP-parity M4), same fake-server capture as
 * `./rewards.test.ts` and `./timers.test.ts`: what is under test is the
 * authorization ladder each handler climbs (scope, then `can()`, then the
 * seam), not the SDK's plumbing. Every seam and query is mocked — no
 * database.
 */

const seams = vi.hoisted(() => ({
  listMembers: vi.fn(),
  getFamily: vi.fn(),
  getMember: vi.fn(),
  createMember: vi.fn(),
  updateMember: vi.fn(),
  deleteMember: vi.fn(),
  updateFamily: vi.fn(),
  setMemberOrder: vi.fn(),
}));

const can = vi.hoisted(() => vi.fn());

vi.mock('@/modules/family', () => ({
  ...seams,
  MEMBER_ROLES: ['owner', 'adult', 'child', 'caregiver'] as const,
  MEMBER_COLORS: ['raspberry', 'blue', 'petrol', 'orchid', 'mustard', 'terracotta'] as const,
  REWARD_HORIZONS: ['instant', 'savings'] as const,
  can,
}));

const { registerFamilyTools } = await import('@/app/api/mcp/tools/family');

const FAMILY_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';

const READ = 'kynite:family.read';
const WRITE = 'kynite:family.write';
const CALENDAR_READ = 'kynite:calendar.read';
const TASKS_READ = 'kynite:tasks.read';

const principal: Principal = {
  kind: 'member',
  familyId: FAMILY_ID,
  memberId: MEMBER_ID,
  role: 'owner',
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

  registerFamilyTools(server, principal, new Set(scopes));
  return tools;
}

async function call(scopes: string[], name: string, input: unknown = {}) {
  const tool = register(scopes).get(name);
  if (!tool) throw new Error(`tool not registered: ${name}`);
  const result = await tool.handler(input);
  return { isError: result.isError === true, body: JSON.parse(result.content[0].text) };
}

const MEMBER_ROW = {
  id: MEMBER_ID,
  familyId: FAMILY_ID,
  userId: null,
  displayName: 'Robin',
  avatarUrl: null,
  color: 'blue',
  role: 'adult',
  birthDate: null,
  rewardHorizon: 'instant',
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const FAMILY_ROW = {
  id: FAMILY_ID,
  name: 'Van Puijenbroek',
  locale: 'nl',
  formattingLocale: 'nl-NL',
  timezone: 'Europe/Amsterdam',
  weekStartsOn: 1,
  hubDefaultView: 'day',
  weatherLatitude: null,
  weatherLongitude: null,
  weatherLocationLabel: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

beforeEach(() => {
  vi.clearAllMocks();
  can.mockReturnValue(true);
});

describe('tool registration', () => {
  it('registers every family tool', () => {
    expect([...register([READ, WRITE]).keys()].sort()).toEqual(
      [
        'create_member',
        'delete_member',
        'get_family',
        'get_member',
        'list_members',
        'reorder_members',
        'update_family',
        'update_member',
      ].sort()
    );
  });
});

describe('list_members', () => {
  it('refuses a token with none of the any-of scopes', async () => {
    const { isError, body } = await call([], 'list_members');

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.listMembers).not.toHaveBeenCalled();
  });

  it('accepts kynite:calendar.read alone', async () => {
    seams.listMembers.mockResolvedValue([MEMBER_ROW]);

    const { isError } = await call([CALENDAR_READ], 'list_members');

    expect(isError).toBe(false);
  });

  it('accepts kynite:tasks.read alone', async () => {
    seams.listMembers.mockResolvedValue([MEMBER_ROW]);

    const { isError } = await call([TASKS_READ], 'list_members');

    expect(isError).toBe(false);
  });

  it('returns members without familyId or userId', async () => {
    seams.listMembers.mockResolvedValue([MEMBER_ROW]);

    const { isError, body } = await call([READ], 'list_members');

    expect(isError).toBe(false);
    expect(seams.listMembers).toHaveBeenCalledWith(FAMILY_ID);
    expect(body).toEqual([{ id: MEMBER_ID, name: 'Robin', role: 'adult', color: 'blue' }]);
    expect(JSON.stringify(body)).not.toContain(FAMILY_ID);
  });
});

describe('get_family', () => {
  it('refuses a token without the read scope', async () => {
    const { isError, body } = await call([WRITE], 'get_family');

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.getFamily).not.toHaveBeenCalled();
  });

  it('reports a missing family as notFound', async () => {
    seams.getFamily.mockResolvedValue(null);

    const { isError, body } = await call([READ], 'get_family');

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'familyNotFound' });
  });

  it('returns the household without its id', async () => {
    seams.getFamily.mockResolvedValue(FAMILY_ROW);

    const { isError, body } = await call([READ], 'get_family');

    expect(isError).toBe(false);
    expect(seams.getFamily).toHaveBeenCalledWith(FAMILY_ID);
    expect(body).toEqual({
      name: 'Van Puijenbroek',
      locale: 'nl',
      formattingLocale: 'nl-NL',
      timezone: 'Europe/Amsterdam',
      weekStartsOn: 1,
      hubDefaultView: 'day',
    });
  });
});

describe('get_member', () => {
  it('refuses a token without the read scope', async () => {
    const { isError, body } = await call([WRITE], 'get_member', { memberId: MEMBER_ID });

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
  });

  it('reports an unknown member as notFound rather than empty', async () => {
    seams.getMember.mockResolvedValue(null);

    const { isError, body } = await call([READ], 'get_member', { memberId: MEMBER_ID });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'memberNotFound' });
  });

  it('returns the member without familyId or userId', async () => {
    seams.getMember.mockResolvedValue(MEMBER_ROW);

    const { isError, body } = await call([READ], 'get_member', { memberId: MEMBER_ID });

    expect(isError).toBe(false);
    expect(seams.getMember).toHaveBeenCalledWith(FAMILY_ID, MEMBER_ID);
    expect(body.id).toBe(MEMBER_ID);
    expect(body.familyId).toBeUndefined();
    expect(body.userId).toBeUndefined();
  });
});

describe('create_member', () => {
  const input = {
    displayName: 'Robin',
    role: 'adult',
    color: 'blue',
    rewardHorizon: 'instant',
    avatarUrl: '',
  };

  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], 'create_member', input);

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.createMember).not.toHaveBeenCalled();
  });

  it('refuses a principal that cannot manage members', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'create_member', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(can).toHaveBeenCalledWith(principal, 'member:manage', { familyId: FAMILY_ID });
    expect(seams.createMember).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    seams.createMember.mockResolvedValue({ status: 'error', error: 'singleOwner' });

    const { isError, body } = await call([WRITE], 'create_member', { ...input, role: 'owner' });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'singleOwner' });
  });

  it('calls the seam and reports success', async () => {
    seams.createMember.mockResolvedValue({ status: 'idle' });

    const { isError, body } = await call([WRITE], 'create_member', input);

    expect(isError).toBe(false);
    expect(seams.createMember).toHaveBeenCalledWith(principal, input);
    expect(body).toEqual({ created: true });
  });
});

describe('update_member', () => {
  const input = {
    memberId: MEMBER_ID,
    displayName: 'Robin',
    role: 'adult',
    color: 'blue',
    rewardHorizon: 'instant',
    avatarUrl: '',
  };

  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], 'update_member', input);

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.updateMember).not.toHaveBeenCalled();
  });

  it('refuses a principal that cannot manage members', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'update_member', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(can).toHaveBeenCalledWith(principal, 'member:manage', {
      familyId: FAMILY_ID,
      memberId: MEMBER_ID,
    });
    expect(seams.updateMember).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    seams.updateMember.mockResolvedValue({ status: 'error', error: 'singleOwner' });

    const { isError, body } = await call([WRITE], 'update_member', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'singleOwner' });
  });

  it('calls the seam and reports success', async () => {
    seams.updateMember.mockResolvedValue({ status: 'idle' });

    const { isError, body } = await call([WRITE], 'update_member', input);

    expect(isError).toBe(false);
    expect(seams.updateMember).toHaveBeenCalledWith(principal, input);
    expect(body).toEqual({ updated: true });
  });
});

describe('delete_member', () => {
  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], 'delete_member', { memberId: MEMBER_ID });

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.deleteMember).not.toHaveBeenCalled();
  });

  it('refuses a principal that cannot manage members', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'delete_member', { memberId: MEMBER_ID });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(seams.deleteMember).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    seams.deleteMember.mockResolvedValue({ status: 'error', error: 'cannotRemoveOwner' });

    const { isError, body } = await call([WRITE], 'delete_member', { memberId: MEMBER_ID });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'cannotRemoveOwner' });
  });

  it('calls the seam and reports success', async () => {
    seams.deleteMember.mockResolvedValue({ status: 'idle' });

    const { isError, body } = await call([WRITE], 'delete_member', { memberId: MEMBER_ID });

    expect(isError).toBe(false);
    expect(seams.deleteMember).toHaveBeenCalledWith(principal, { memberId: MEMBER_ID });
    expect(body).toEqual({ deleted: true });
  });
});

describe('update_family', () => {
  const input = {
    name: 'Van Puijenbroek',
    locale: 'nl',
    formattingLocale: 'nl-NL',
    timezone: 'Europe/Amsterdam',
    weekStartsOn: 1,
  };

  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], 'update_family', input);

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.updateFamily).not.toHaveBeenCalled();
  });

  it('refuses a principal that cannot manage the household', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'update_family', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(can).toHaveBeenCalledWith(principal, 'family:manage', { familyId: FAMILY_ID });
    expect(seams.updateFamily).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    seams.updateFamily.mockResolvedValue({ status: 'error', error: 'invalidInput' });

    const { isError, body } = await call([WRITE], 'update_family', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'invalidInput' });
  });

  it('calls the seam and reports success', async () => {
    seams.updateFamily.mockResolvedValue({ status: 'idle' });

    const { isError, body } = await call([WRITE], 'update_family', input);

    expect(isError).toBe(false);
    expect(seams.updateFamily).toHaveBeenCalledWith(principal, input);
    expect(body).toEqual({ updated: true });
  });
});

describe('reorder_members', () => {
  const OTHER_MEMBER_ID = '33333333-3333-4333-8333-333333333333';
  const orderedIds = [OTHER_MEMBER_ID, MEMBER_ID];

  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], 'reorder_members', { orderedIds });

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.setMemberOrder).not.toHaveBeenCalled();
  });

  it('refuses a principal that cannot manage members', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'reorder_members', { orderedIds });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(can).toHaveBeenCalledWith(principal, 'member:manage', { familyId: FAMILY_ID });
    expect(seams.setMemberOrder).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    seams.setMemberOrder.mockResolvedValue({ status: 'error', error: 'invalidInput' });

    const { isError, body } = await call([WRITE], 'reorder_members', { orderedIds });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'invalidInput' });
  });

  it('calls the seam and reports success', async () => {
    seams.setMemberOrder.mockResolvedValue({ status: 'idle' });

    const { isError, body } = await call([WRITE], 'reorder_members', { orderedIds });

    expect(isError).toBe(false);
    expect(seams.setMemberOrder).toHaveBeenCalledWith(principal, { orderedIds });
    expect(body).toEqual({ reordered: true });
  });
});
