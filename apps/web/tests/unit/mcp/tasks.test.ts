import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Principal } from '@/modules/family';
import type { McpToolServer } from '@/app/api/mcp/tools/shared';

/**
 * The tasks MCP tools (MCP-parity M2), same fake-server capture as
 * `./routines.test.ts`: what is under test is the authorization ladder each
 * handler climbs (scope, then `can()`, then the seam), not the SDK's
 * plumbing. Every seam and query is mocked — no database.
 */

const seams = vi.hoisted(() => ({
  listTodayTasks: vi.fn(),
  getTask: vi.fn(),
  createTask: vi.fn(),
  toggleTask: vi.fn(),
  deleteTask: vi.fn(),
}));

const can = vi.hoisted(() => vi.fn());
const getFamily = vi.hoisted(() => vi.fn());
const startOfDay = vi.hoisted(() => vi.fn());

vi.mock('@/modules/tasks', () => ({ ...seams }));
// The family barrel re-exports client components; only `can`/`getFamily` are
// reached here.
vi.mock('@/modules/family', () => ({ can, getFamily }));
vi.mock('@/modules/calendar', () => ({ startOfDay }));

const { registerTasksTools } = await import('@/app/api/mcp/tools/tasks');

const FAMILY_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const TASK_ID = '33333333-3333-4333-8333-333333333333';

const READ = 'kynite:tasks.read';
const WRITE = 'kynite:tasks.write';

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

  registerTasksTools(server, principal, new Set(scopes));
  return tools;
}

async function call(scopes: string[], name: string, input: unknown = {}) {
  const tool = register(scopes).get(name);
  if (!tool) throw new Error(`tool not registered: ${name}`);
  const result = await tool.handler(input);
  return { isError: result.isError === true, body: JSON.parse(result.content[0].text) };
}

const TASK_ROW = {
  id: TASK_ID,
  familyId: FAMILY_ID,
  assigneeMemberId: MEMBER_ID,
  title: 'Hond uitlaten',
  dueDate: '2026-09-13',
  completedAt: null,
  createdByMemberId: MEMBER_ID,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

beforeEach(() => {
  vi.clearAllMocks();
  can.mockReturnValue(true);
  getFamily.mockResolvedValue({ timezone: 'Europe/Amsterdam' });
  startOfDay.mockReturnValue(new Date(0));
});

describe('tool registration', () => {
  it('registers every tasks tool', () => {
    expect([...register([READ, WRITE]).keys()].sort()).toEqual(
      ['create_task', 'delete_task', 'get_task', 'list_tasks', 'toggle_task'].sort()
    );
  });
});

describe('list_tasks', () => {
  it('refuses a token without the read scope', async () => {
    const { isError, body } = await call([WRITE], 'list_tasks');

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.listTodayTasks).not.toHaveBeenCalled();
  });

  it('returns tasks without familyId', async () => {
    seams.listTodayTasks.mockResolvedValue([TASK_ROW]);

    const { isError, body } = await call([READ], 'list_tasks');

    expect(isError).toBe(false);
    expect(seams.listTodayTasks).toHaveBeenCalledWith(
      expect.objectContaining({ familyId: FAMILY_ID })
    );
    expect(body).toEqual([
      {
        id: TASK_ID,
        title: 'Hond uitlaten',
        assigneeMemberId: MEMBER_ID,
        dueDate: '2026-09-13',
        done: false,
      },
    ]);
    expect(JSON.stringify(body)).not.toContain(FAMILY_ID);
  });

  it('filters by memberId in the tool layer', async () => {
    seams.listTodayTasks.mockResolvedValue([
      TASK_ROW,
      { ...TASK_ROW, id: 'other', assigneeMemberId: 'someone-else' },
    ]);

    const { body } = await call([READ], 'list_tasks', { memberId: MEMBER_ID });

    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(TASK_ID);
  });

  it('passes an explicit date through as the todayKey', async () => {
    seams.listTodayTasks.mockResolvedValue([]);

    await call([READ], 'list_tasks', { date: '2026-01-01' });

    expect(seams.listTodayTasks).toHaveBeenCalledWith(
      expect.objectContaining({ familyId: FAMILY_ID, todayKey: '2026-01-01' })
    );
  });
});

describe('get_task', () => {
  it('refuses a token without the read scope', async () => {
    const { isError, body } = await call([], 'get_task', { taskId: TASK_ID });

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
  });

  it('reports an unknown task as notFound rather than empty', async () => {
    seams.getTask.mockResolvedValue(null);

    const { isError, body } = await call([READ], 'get_task', { taskId: TASK_ID });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'taskNotFound' });
  });

  it('returns the task', async () => {
    seams.getTask.mockResolvedValue(TASK_ROW);

    const { isError, body } = await call([READ], 'get_task', { taskId: TASK_ID });

    expect(isError).toBe(false);
    expect(seams.getTask).toHaveBeenCalledWith(FAMILY_ID, TASK_ID);
    expect(body.id).toBe(TASK_ID);
    expect(body.familyId).toBeUndefined();
  });
});

describe('create_task', () => {
  const input = { title: 'Prullenbak buiten zetten', assigneeMemberId: MEMBER_ID, dueDate: null };

  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], 'create_task', input);

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.createTask).not.toHaveBeenCalled();
  });

  it('refuses a member whose role cannot write tasks', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'create_task', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(can).toHaveBeenCalledWith(principal, 'task:write', { familyId: FAMILY_ID });
    expect(seams.createTask).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    seams.createTask.mockResolvedValue({ ok: false, error: 'memberNotFound' });

    const { isError, body } = await call([WRITE], 'create_task', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'memberNotFound' });
  });

  it('calls the seam with the principal and returns the task id', async () => {
    seams.createTask.mockResolvedValue({ ok: true, taskId: TASK_ID });

    const { isError, body } = await call([WRITE], 'create_task', input);

    expect(isError).toBe(false);
    expect(seams.createTask).toHaveBeenCalledWith(principal, input);
    expect(body).toEqual({ taskId: TASK_ID });
  });
});

describe('toggle_task', () => {
  const input = { taskId: TASK_ID, completed: true };

  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], 'toggle_task', input);

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.toggleTask).not.toHaveBeenCalled();
  });

  it('checks task:complete, not task:write', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'toggle_task', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(can).toHaveBeenCalledWith(principal, 'task:complete', { familyId: FAMILY_ID });
    expect(seams.toggleTask).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    seams.toggleTask.mockResolvedValue({ ok: false, error: 'taskNotFound' });

    const { isError, body } = await call([WRITE], 'toggle_task', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'taskNotFound' });
  });

  it('calls the seam and returns the task id', async () => {
    seams.toggleTask.mockResolvedValue({ ok: true, taskId: TASK_ID });

    const { isError, body } = await call([WRITE], 'toggle_task', input);

    expect(isError).toBe(false);
    expect(seams.toggleTask).toHaveBeenCalledWith(principal, input);
    expect(body).toEqual({ taskId: TASK_ID });
  });
});

describe('delete_task', () => {
  const input = { taskId: TASK_ID };

  it('refuses a token without the write scope', async () => {
    const { isError, body } = await call([READ], 'delete_task', input);

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.deleteTask).not.toHaveBeenCalled();
  });

  it('checks task:write', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'delete_task', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(can).toHaveBeenCalledWith(principal, 'task:write', { familyId: FAMILY_ID });
    expect(seams.deleteTask).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    seams.deleteTask.mockResolvedValue({ ok: false, error: 'taskNotFound' });

    const { isError, body } = await call([WRITE], 'delete_task', input);

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'taskNotFound' });
  });

  it('calls the seam and returns the task id', async () => {
    seams.deleteTask.mockResolvedValue({ ok: true, taskId: TASK_ID });

    const { isError, body } = await call([WRITE], 'delete_task', input);

    expect(isError).toBe(false);
    expect(seams.deleteTask).toHaveBeenCalledWith(principal, input);
    expect(body).toEqual({ taskId: TASK_ID });
  });
});
