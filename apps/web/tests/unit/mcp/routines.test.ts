import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Principal } from '@/modules/family';
import type { McpToolServer } from '@/app/api/mcp/tools/shared';

/**
 * The routines MCP tools (MCP-parity M1).
 *
 * Registration is tested by handing `registerRoutinesTools` a **fake server**
 * that captures each `registerTool(name, config, handler)` call, then invoking
 * the handler directly. That is deliberately lighter than standing up a real
 * `McpServer` over `InMemoryTransport`: what is under test here is the
 * authorization ladder each handler climbs — scope, then `can()`, then the
 * seam — not the SDK's JSON-RPC plumbing, which is not ours.
 *
 * Every seam and query is mocked: no database, and no chance of a test passing
 * because a write silently did nothing.
 */

const seams = vi.hoisted(() => ({
  listRoutines: vi.fn(),
  getRoutine: vi.fn(),
  listSteps: vi.fn(),
  createRoutine: vi.fn(),
  updateRoutine: vi.fn(),
  deleteRoutine: vi.fn(),
  setRoutineActive: vi.fn(),
  setRoutineReward: vi.fn(),
  completeStep: vi.fn(),
  undoCompletion: vi.fn(),
}));

const can = vi.hoisted(() => vi.fn());

vi.mock('@/modules/routines', () => ({
  ...seams,
  MAX_GRACE_DAYS: 7,
  ROUTINE_ICONS: ['sun', 'moon'] as const,
  SCHEDULE_KINDS: ['recurring', 'once'] as const,
  WEEKDAYS: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const,
}));

// The family barrel re-exports client components; only `can` is reached here.
vi.mock('@/modules/family', () => ({ can }));

const { registerRoutinesTools } = await import('@/app/api/mcp/tools/routines');

const FAMILY_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const ROUTINE_ID = '33333333-3333-4333-8333-333333333333';
const STEP_ID = '44444444-4444-4444-8444-444444444444';

const READ = 'kynite:routines.read';
const WRITE = 'kynite:routines.write';

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

  registerRoutinesTools(server, principal, new Set(scopes));
  return tools;
}

/** Invoke one tool's handler and decode its JSON payload. */
async function call(scopes: string[], name: string, input: unknown = {}) {
  const tool = register(scopes).get(name);
  if (!tool) throw new Error(`tool not registered: ${name}`);
  const result = await tool.handler(input);
  return { isError: result.isError === true, body: JSON.parse(result.content[0].text) };
}

const ROUTINE_ROW = {
  id: ROUTINE_ID,
  familyId: FAMILY_ID,
  title: 'Ochtend',
  icon: 'sun',
  ownerMemberId: MEMBER_ID,
  schedule: { kind: 'recurring', rrule: 'FREQ=WEEKLY;BYDAY=MO', timeOfDay: '07:30', graceDays: 0 },
  starsPerCompletion: 1,
  rewardEnabled: true,
  fadedAt: null,
  active: true,
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const STEP_ROW = {
  id: STEP_ID,
  routineId: ROUTINE_ID,
  title: 'Tanden poetsen',
  timerSeconds: 120,
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const ROUTINE_BODY = {
  title: 'Ochtend',
  icon: 'sun',
  ownerMemberId: MEMBER_ID,
  scheduleKind: 'recurring',
  weekdays: ['MO'],
  onceDate: '',
  timeOfDay: '07:30',
  graceDays: 0,
  starsPerCompletion: 1,
  rewardEnabled: true,
  active: true,
  steps: [{ id: '', title: 'Tanden poetsen', timerSeconds: 120 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  can.mockReturnValue(true);
});

/** One tool's declared zod input schema, for the star-rate assertions below. */
function schemaOf(name: string) {
  const tool = register([READ, WRITE]).get(name);
  if (!tool) throw new Error(`tool not registered: ${name}`);
  return (
    tool.config as {
      inputSchema: {
        safeParse: (input: unknown) => { success: boolean; data?: { starsPerCompletion?: number } };
      };
    }
  ).inputSchema;
}

describe('tool registration', () => {
  it('registers every routines tool', () => {
    expect([...register([READ, WRITE]).keys()].sort()).toEqual(
      [
        'complete_step',
        'create_routine',
        'delete_routine',
        'get_routine',
        'list_routines',
        'set_routine_active',
        'set_routine_reward',
        'undo_completion',
        'update_routine',
      ].sort()
    );
  });
});

describe('list_routines', () => {
  it('refuses a token without the read scope', async () => {
    const { isError, body } = await call([WRITE], 'list_routines');

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.listRoutines).not.toHaveBeenCalled();
  });

  it('returns routines with steps and without familyId', async () => {
    seams.listRoutines.mockResolvedValue([{ ...ROUTINE_ROW, steps: [STEP_ROW] }]);

    const { isError, body } = await call([READ], 'list_routines', { activeOnly: true });

    expect(isError).toBe(false);
    expect(seams.listRoutines).toHaveBeenCalledWith(FAMILY_ID, {
      ownerMemberId: undefined,
      activeOnly: true,
    });
    expect(body).toEqual([
      {
        id: ROUTINE_ID,
        title: 'Ochtend',
        icon: 'sun',
        ownerMemberId: MEMBER_ID,
        schedule: ROUTINE_ROW.schedule,
        starsPerCompletion: 1,
        rewardEnabled: true,
        faded: false,
        active: true,
        steps: [{ id: STEP_ID, title: 'Tanden poetsen', timerSeconds: 120, sortOrder: 0 }],
      },
    ]);
    expect(JSON.stringify(body)).not.toContain(FAMILY_ID);
  });
});

describe('get_routine', () => {
  it('refuses a token without the read scope', async () => {
    const { isError, body } = await call([], 'get_routine', { routineId: ROUTINE_ID });

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
  });

  it('reports an unknown routine as notFound rather than empty', async () => {
    seams.getRoutine.mockResolvedValue(null);

    const { isError, body } = await call([READ], 'get_routine', { routineId: ROUTINE_ID });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'routineNotFound' });
    expect(seams.listSteps).not.toHaveBeenCalled();
  });

  it('returns the routine with its steps', async () => {
    seams.getRoutine.mockResolvedValue(ROUTINE_ROW);
    seams.listSteps.mockResolvedValue([STEP_ROW]);

    const { isError, body } = await call([READ], 'get_routine', { routineId: ROUTINE_ID });

    expect(isError).toBe(false);
    expect(seams.getRoutine).toHaveBeenCalledWith(FAMILY_ID, ROUTINE_ID);
    expect(body.id).toBe(ROUTINE_ID);
    expect(body.steps).toHaveLength(1);
    expect(body.familyId).toBeUndefined();
  });
});

/**
 * The four routine-body writes share one ladder, so they share one table:
 * scope, then `can('routine:write')`, then the seam — and the seam is never
 * reached when either refuses.
 */
const ROUTINE_WRITES: {
  name: string;
  input: Record<string, unknown>;
  seam: ReturnType<typeof vi.fn>;
  expected: unknown;
}[] = [
  {
    name: 'create_routine',
    input: ROUTINE_BODY,
    seam: seams.createRoutine,
    expected: [principal, ROUTINE_BODY],
  },
  {
    name: 'update_routine',
    input: { routineId: ROUTINE_ID, ...ROUTINE_BODY },
    seam: seams.updateRoutine,
    expected: [principal, { routineId: ROUTINE_ID, ...ROUTINE_BODY }],
  },
  {
    name: 'delete_routine',
    input: { routineId: ROUTINE_ID },
    seam: seams.deleteRoutine,
    expected: [principal, { routineId: ROUTINE_ID }],
  },
  {
    name: 'set_routine_active',
    input: { routineId: ROUTINE_ID, active: false },
    seam: seams.setRoutineActive,
    expected: [principal, { routineId: ROUTINE_ID, active: false }],
  },
  {
    name: 'set_routine_reward',
    input: { routineId: ROUTINE_ID, rewardEnabled: false },
    seam: seams.setRoutineReward,
    expected: [principal, { routineId: ROUTINE_ID, rewardEnabled: false }],
  },
];

describe.each(ROUTINE_WRITES)('$name', ({ name, input, seam, expected }) => {
  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], name, input);

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seam).not.toHaveBeenCalled();
  });

  it('refuses a member whose role cannot write routines', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], name, input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(can).toHaveBeenCalledWith(principal, 'routine:write', { familyId: FAMILY_ID });
    expect(seam).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    seam.mockResolvedValue({ ok: false, error: 'routineNotFound' });

    const { isError, body } = await call([WRITE], name, input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'routineNotFound' });
  });

  it('calls the seam with the principal and returns the routine id', async () => {
    seam.mockResolvedValue({ ok: true, routineId: ROUTINE_ID, memberIds: [MEMBER_ID] });

    const { isError, body } = await call([WRITE], name, input);

    expect(isError).toBe(false);
    expect(seam).toHaveBeenCalledWith(...(expected as unknown[]));
    expect(body).toEqual({ routineId: ROUTINE_ID });
  });
});

describe('complete_step', () => {
  const input = {
    routineId: ROUTINE_ID,
    routineStepId: STEP_ID,
    memberId: MEMBER_ID,
    occurrenceDate: '2026-09-13',
    clientId: 'member-step-2026-09-13',
  };

  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], 'complete_step', input);

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.completeStep).not.toHaveBeenCalled();
  });

  it('checks completion:write against the subject member, not just the family', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'complete_step', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(can).toHaveBeenCalledWith(principal, 'completion:write', {
      familyId: FAMILY_ID,
      memberId: MEMBER_ID,
    });
    expect(seams.completeStep).not.toHaveBeenCalled();
  });

  it('records the completion and reports the stars it paid', async () => {
    seams.completeStep.mockResolvedValue({ status: 'done', stars: 1, replayed: false });

    const { isError, body } = await call([WRITE], 'complete_step', input);

    expect(isError).toBe(false);
    expect(seams.completeStep).toHaveBeenCalledWith(principal, { ...input, source: 'mobile' });
    expect(body).toEqual({ completed: true, stars: 1, replayed: false });
  });

  it('reports a replay as a completion that paid nothing', async () => {
    seams.completeStep.mockResolvedValue({ status: 'done', stars: 0, replayed: true });

    const { body } = await call([WRITE], 'complete_step', input);

    expect(body).toEqual({ completed: true, stars: 0, replayed: true });
  });

  it('passes the seam’s error through', async () => {
    seams.completeStep.mockResolvedValue({ status: 'error', error: 'invalidInput' });

    const { isError, body } = await call([WRITE], 'complete_step', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'invalidInput' });
  });
});

describe('undo_completion', () => {
  const input = { clientId: 'member-step-2026-09-13' };

  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], 'undo_completion', input);

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.undoCompletion).not.toHaveBeenCalled();
  });

  it('refuses a principal that cannot write completions', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'undo_completion', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(can).toHaveBeenCalledWith(principal, 'completion:write', { familyId: FAMILY_ID });
    expect(seams.undoCompletion).not.toHaveBeenCalled();
  });

  it('names the board that has to refresh', async () => {
    seams.undoCompletion.mockResolvedValue({ status: 'undone', memberId: MEMBER_ID });

    const { isError, body } = await call([WRITE], 'undo_completion', input);

    expect(isError).toBe(false);
    expect(seams.undoCompletion).toHaveBeenCalledWith(principal, input);
    expect(body).toEqual({ undone: true, memberId: MEMBER_ID });
  });

  it('passes an unknown clientId through as a tool error', async () => {
    seams.undoCompletion.mockResolvedValue({ status: 'error', error: 'completionNotFound' });

    const { isError, body } = await call([WRITE], 'undo_completion', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'completionNotFound' });
  });
});

/**
 * The MCP layer caps the star rate at 5 where the seam still allows 0-20: the
 * app's own routine editor keeps the wider range, but a host that quietly
 * raises the rate is the failure mode this layer exists for. And because stars
 * pay per *step*, the rate a host omits must land on 1, not on nothing.
 */
describe('starsPerCompletion', () => {
  const { starsPerCompletion: _omitted, ...WITHOUT_RATE } = ROUTINE_BODY;

  it('defaults to 1 when create_routine omits it', () => {
    const parsed = schemaOf('create_routine').safeParse(WITHOUT_RATE);

    expect(parsed.success).toBe(true);
    expect(parsed.data?.starsPerCompletion).toBe(1);
  });

  it('accepts a rate inside the cap', () => {
    expect(
      schemaOf('create_routine').safeParse({ ...WITHOUT_RATE, starsPerCompletion: 5 }).success
    ).toBe(true);
  });

  it('refuses a rate above 5', () => {
    expect(
      schemaOf('create_routine').safeParse({ ...WITHOUT_RATE, starsPerCompletion: 6 }).success
    ).toBe(false);
  });

  it('allows 0 — the routine a child already enjoys', () => {
    expect(
      schemaOf('create_routine').safeParse({ ...WITHOUT_RATE, starsPerCompletion: 0 }).success
    ).toBe(true);
  });

  it('applies the same cap to update_routine', () => {
    const body = { ...WITHOUT_RATE, routineId: ROUTINE_ID };

    expect(schemaOf('update_routine').safeParse({ ...body, starsPerCompletion: 6 }).success).toBe(
      false
    );
    expect(schemaOf('update_routine').safeParse({ ...body, starsPerCompletion: 5 }).success).toBe(
      true
    );
  });
});
