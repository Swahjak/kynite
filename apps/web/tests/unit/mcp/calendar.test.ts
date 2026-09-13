import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Principal } from '@/modules/family';
import type { McpToolServer } from '@/app/api/mcp/tools/shared';

/**
 * The calendar MCP tools, registered through the same fake-server capture as
 * `./routines.test.ts`. The coverage here is deliberately narrow: these tools
 * moved out of `route.ts` unchanged in M1, so what needs proving is that each
 * one is still *registered* and still refuses a token without its scope — the
 * failure mode a file split actually has.
 */

const listFamilyCalendars = vi.hoisted(() => vi.fn());

vi.mock('@/modules/google', () => ({ listFamilyCalendars }));
vi.mock('@/modules/calendar', () => ({
  EVENT_TYPES: ['appointment'] as const,
  RECURRENCE_PRESETS: ['none'] as const,
  WEEKDAYS: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const,
  createEvent: vi.fn(),
  listEvents: vi.fn(),
  skipEventOccurrence: vi.fn(),
  updateEventOccurrence: vi.fn(),
}));
vi.mock('@/modules/family', () => ({ can: vi.fn(), decide: vi.fn() }));
vi.mock('@/server/db', () => ({ getDb: vi.fn() }));

const { registerCalendarTools } = await import('@/app/api/mcp/tools/calendar');

const FAMILY_ID = '11111111-1111-4111-8111-111111111111';
const CALENDAR_ID = '55555555-5555-4555-8555-555555555555';
const READ = 'kynite:calendar.read';

const principal = {
  kind: 'member',
  familyId: FAMILY_ID,
  memberId: '22222222-2222-4222-8222-222222222222',
  role: 'adult',
} as Principal;

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };
type Handler = (input: unknown) => Promise<ToolResult>;

function register(scopes: string[]): Map<string, Handler> {
  const tools = new Map<string, Handler>();
  const server = {
    registerTool: (name: string, _config: unknown, handler: Handler) => tools.set(name, handler),
  } as unknown as McpToolServer;

  registerCalendarTools(server, principal, new Set(scopes));
  return tools;
}

async function call(scopes: string[], name: string, input: unknown = {}) {
  const handler = register(scopes).get(name);
  if (!handler) throw new Error(`tool not registered: ${name}`);
  const result = await handler(input);
  return { isError: result.isError === true, body: JSON.parse(result.content[0].text) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('tool registration', () => {
  it('registers every calendar tool the pre-split route.ts had', () => {
    expect([...register([READ]).keys()].sort()).toEqual([
      'create_event',
      'list_calendars',
      'list_events',
      'skip_event_occurrence',
      'update_event_occurrence',
    ]);
  });
});

describe('list_calendars', () => {
  it('refuses a token without kynite:calendar.read', async () => {
    const { isError, body } = await call([], 'list_calendars');

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'insufficientScope: requires kynite:calendar.read' });
    expect(listFamilyCalendars).not.toHaveBeenCalled();
  });

  it('reports each calendar and whether it is native to Kynite', async () => {
    listFamilyCalendars.mockResolvedValue([
      {
        id: CALENDAR_ID,
        summary: 'Gezin',
        googleAccountId: null,
        writable: true,
        visibility: 'family',
        familyId: FAMILY_ID,
      },
      {
        id: '66666666-6666-4666-8666-666666666666',
        summary: 'Werk',
        googleAccountId: 'acct_1',
        writable: false,
        visibility: 'busy',
        familyId: FAMILY_ID,
      },
    ]);

    const { isError, body } = await call([READ], 'list_calendars');

    expect(isError).toBe(false);
    expect(listFamilyCalendars).toHaveBeenCalledWith(FAMILY_ID);
    expect(body).toEqual([
      { id: CALENDAR_ID, summary: 'Gezin', native: true, writable: true, visibility: 'family' },
      {
        id: '66666666-6666-4666-8666-666666666666',
        summary: 'Werk',
        native: false,
        writable: false,
        visibility: 'busy',
      },
    ]);
  });
});
