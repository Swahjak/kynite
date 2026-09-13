import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Principal } from '@/modules/family';
import type { McpToolServer } from '@/app/api/mcp/tools/shared';

/**
 * The timers MCP tools (MCP-parity M2), same fake-server capture as
 * `./routines.test.ts`: what is under test is the authorization ladder each
 * handler climbs (scope, then `can()`, then the seam), not the SDK's
 * plumbing. Every seam and query is mocked — no database.
 */

const seams = vi.hoisted(() => ({
  listRunningTimers: vi.fn(),
  listRecentTimers: vi.fn(),
  getTimer: vi.fn(),
  startTimer: vi.fn(),
  stopTimer: vi.fn(),
  pauseTimer: vi.fn(),
  resumeTimer: vi.fn(),
  extendTimer: vi.fn(),
}));

const can = vi.hoisted(() => vi.fn());

vi.mock('@/modules/timers', () => ({
  ...seams,
  EXTEND_PRESET_MINUTES: [1, 5, 10] as const,
  MAX_DURATION_SECONDS: 4 * 60 * 60,
  isTimerIcon: () => true,
}));

// The family barrel re-exports client components; only `can` is reached here.
vi.mock('@/modules/family', () => ({ can }));

const { registerTimersTools } = await import('@/app/api/mcp/tools/timers');

const FAMILY_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const TIMER_ID = '33333333-3333-4333-8333-333333333333';

const READ = 'kynite:timers.read';
const WRITE = 'kynite:timers.write';

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

  registerTimersTools(server, principal, new Set(scopes));
  return tools;
}

async function call(scopes: string[], name: string, input: unknown = {}) {
  const tool = register(scopes).get(name);
  if (!tool) throw new Error(`tool not registered: ${name}`);
  const result = await tool.handler(input);
  return { isError: result.isError === true, body: JSON.parse(result.content[0].text) };
}

const TIMER_ROW = {
  id: TIMER_ID,
  familyId: FAMILY_ID,
  memberId: MEMBER_ID,
  routineId: null,
  routineStepId: null,
  label: 'Schoenen aan',
  durationSeconds: 300,
  startedAt: new Date(0),
  stoppedAt: null,
  pausedAt: null,
  pausedSeconds: 0,
  icon: null,
  warningLeadSeconds: 60,
  startedByMemberId: MEMBER_ID,
  clientId: 'abc-client-id',
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

beforeEach(() => {
  vi.clearAllMocks();
  can.mockReturnValue(true);
});

describe('tool registration', () => {
  it('registers every timers tool', () => {
    expect([...register([READ, WRITE]).keys()].sort()).toEqual(
      [
        'extend_timer',
        'get_timer',
        'list_timers',
        'pause_timer',
        'resume_timer',
        'start_timer',
        'stop_timer',
      ].sort()
    );
  });
});

describe('list_timers', () => {
  it('refuses a token without the read scope', async () => {
    const { isError, body } = await call([WRITE], 'list_timers');

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.listRunningTimers).not.toHaveBeenCalled();
  });

  it('returns running and recent timers without familyId or clientId', async () => {
    seams.listRunningTimers.mockResolvedValue([TIMER_ROW]);
    seams.listRecentTimers.mockResolvedValue([TIMER_ROW]);

    const { isError, body } = await call([READ], 'list_timers', { recentLimit: 5 });

    expect(isError).toBe(false);
    expect(seams.listRunningTimers).toHaveBeenCalledWith(FAMILY_ID);
    expect(seams.listRecentTimers).toHaveBeenCalledWith(FAMILY_ID, 5);
    expect(body.running).toEqual([
      {
        id: TIMER_ID,
        memberId: MEMBER_ID,
        routineId: null,
        routineStepId: null,
        label: 'Schoenen aan',
        durationSeconds: 300,
        startedAt: TIMER_ROW.startedAt.toISOString(),
        stoppedAt: null,
        pausedAt: null,
        pausedSeconds: 0,
        icon: null,
        warningLeadSeconds: 60,
      },
    ]);
    expect(JSON.stringify(body)).not.toContain(FAMILY_ID);
    expect(JSON.stringify(body)).not.toContain('abc-client-id');
  });
});

describe('get_timer', () => {
  it('refuses a token without the read scope', async () => {
    const { isError, body } = await call([], 'get_timer', { timerId: TIMER_ID });

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
  });

  it('reports an unknown timer as notFound rather than empty', async () => {
    seams.getTimer.mockResolvedValue(null);

    const { isError, body } = await call([READ], 'get_timer', { timerId: TIMER_ID });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'timerNotFound' });
  });

  it('returns the timer', async () => {
    seams.getTimer.mockResolvedValue(TIMER_ROW);

    const { isError, body } = await call([READ], 'get_timer', { timerId: TIMER_ID });

    expect(isError).toBe(false);
    expect(seams.getTimer).toHaveBeenCalledWith(FAMILY_ID, TIMER_ID);
    expect(body.id).toBe(TIMER_ID);
    expect(body.familyId).toBeUndefined();
  });
});

describe('start_timer', () => {
  const input = { label: 'Schoenen aan', durationSeconds: 300, memberId: MEMBER_ID };

  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], 'start_timer', input);

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.startTimer).not.toHaveBeenCalled();
  });

  it('checks timer:control against the subject member', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'start_timer', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(can).toHaveBeenCalledWith(principal, 'timer:control', {
      familyId: FAMILY_ID,
      memberId: MEMBER_ID,
    });
    expect(seams.startTimer).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    seams.startTimer.mockResolvedValue({ status: 'error', error: 'invalidInput' });

    const { isError, body } = await call([WRITE], 'start_timer', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'invalidInput' });
  });

  it('calls the seam and reports the started timer', async () => {
    seams.startTimer.mockResolvedValue({ status: 'started', timerId: TIMER_ID, replayed: false });

    const { isError, body } = await call([WRITE], 'start_timer', input);

    expect(isError).toBe(false);
    expect(seams.startTimer).toHaveBeenCalledWith(principal, input);
    expect(body).toEqual({ timerId: TIMER_ID, replayed: false });
  });
});

describe.each([
  {
    name: 'stop_timer',
    seam: () => seams.stopTimer,
    status: 'stopped',
    payload: { stopped: true },
  },
  {
    name: 'pause_timer',
    seam: () => seams.pauseTimer,
    status: 'paused',
    payload: { paused: true },
  },
  {
    name: 'resume_timer',
    seam: () => seams.resumeTimer,
    status: 'resumed',
    payload: { resumed: true },
  },
])('$name', ({ name, seam, status, payload }) => {
  const input = { timerId: TIMER_ID };

  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], name, input);

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seam()).not.toHaveBeenCalled();
  });

  it('refuses a principal that cannot control timers', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], name, input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(can).toHaveBeenCalledWith(principal, 'timer:control', {
      familyId: FAMILY_ID,
      memberId: null,
    });
    expect(seam()).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    seam().mockResolvedValue({ status: 'error', error: 'timerNotFound' });

    const { isError, body } = await call([WRITE], name, input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'timerNotFound' });
  });

  it('calls the seam and reports success', async () => {
    seam().mockResolvedValue({ status });

    const { isError, body } = await call([WRITE], name, input);

    expect(isError).toBe(false);
    expect(seam()).toHaveBeenCalledWith(principal, input);
    expect(body).toEqual(payload);
  });
});

describe('extend_timer', () => {
  const input = { timerId: TIMER_ID, minutes: 5 };

  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], 'extend_timer', input);

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.extendTimer).not.toHaveBeenCalled();
  });

  it('refuses a principal that cannot control timers', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'extend_timer', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(seams.extendTimer).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    seams.extendTimer.mockResolvedValue({ status: 'error', error: 'timerNotFound' });

    const { isError, body } = await call([WRITE], 'extend_timer', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'timerNotFound' });
  });

  it('reports the new duration on success', async () => {
    seams.extendTimer.mockResolvedValue({ status: 'extended', durationSeconds: 600 });

    const { isError, body } = await call([WRITE], 'extend_timer', input);

    expect(isError).toBe(false);
    expect(seams.extendTimer).toHaveBeenCalledWith(principal, input);
    expect(body).toEqual({ status: 'extended', durationSeconds: 600 });
  });

  it('reports atMaximum as a successful no-op', async () => {
    seams.extendTimer.mockResolvedValue({ status: 'atMaximum', durationSeconds: 14400 });

    const { isError, body } = await call([WRITE], 'extend_timer', input);

    expect(isError).toBe(false);
    expect(body).toEqual({ status: 'atMaximum', durationSeconds: 14400 });
  });
});
