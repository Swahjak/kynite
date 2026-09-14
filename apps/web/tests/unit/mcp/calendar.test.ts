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

const seams = vi.hoisted(() => ({
  createEvent: vi.fn(),
  listEvents: vi.fn(),
  getEvent: vi.fn(),
  skipEventOccurrence: vi.fn(),
  updateEvent: vi.fn(),
  updateEventOccurrence: vi.fn(),
  deleteEvent: vi.fn(),
}));

const can = vi.hoisted(() => vi.fn());
const decide = vi.hoisted(() => vi.fn());
const presetFor = vi.hoisted(() => vi.fn(() => 'weekly'));
const weeklyDaysOf = vi.hoisted(() => vi.fn(() => ['MO', 'TH']));
const dbSelect = vi.hoisted(() => vi.fn());
const getDb = vi.hoisted(() => vi.fn(() => ({ select: dbSelect })));

vi.mock('@/modules/google', () => ({ listFamilyCalendars }));
vi.mock('@/modules/calendar', () => ({
  EVENT_TYPES: ['appointment'] as const,
  RECURRENCE_PRESETS: ['none'] as const,
  WEEKDAYS: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const,
  BUSY_LABEL: 'busy',
  presetFor,
  weeklyDaysOf,
  ...seams,
}));
vi.mock('@/modules/family', () => ({ can, decide }));
vi.mock('@/server/db', () => ({ getDb }));
vi.mock('@/server/db/schema', () => ({
  calendar: {},
  icsSubscription: {},
}));

const { registerCalendarTools } = await import('@/app/api/mcp/tools/calendar');

const FAMILY_ID = '11111111-1111-4111-8111-111111111111';
const CALENDAR_ID = '55555555-5555-4555-8555-555555555555';
const EVENT_ID = '77777777-7777-4777-8777-777777777777';
const READ = 'kynite:calendar.read';
const WRITE = 'kynite:calendar.write';

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
  it('registers every calendar tool', () => {
    expect([...register([READ]).keys()].sort()).toEqual([
      'create_event',
      'delete_event',
      'get_event',
      'list_calendars',
      'list_events',
      'skip_event_occurrence',
      'update_event',
      'update_event_occurrence',
    ]);
  });
});

function mockCalendarRow(row: { visibility: string; ownerMemberId: string | null } | null) {
  dbSelect.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => (row ? [row] : []),
      }),
    }),
  });
}

describe('get_event', () => {
  it('refuses a token without kynite:calendar.read', async () => {
    const { isError, body } = await call([], 'get_event', { eventId: EVENT_ID });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'insufficientScope: requires kynite:calendar.read' });
    expect(seams.getEvent).not.toHaveBeenCalled();
  });

  it('reports eventNotFound for an unknown id', async () => {
    seams.getEvent.mockResolvedValue(null);

    const { isError, body } = await call([READ], 'get_event', { eventId: EVENT_ID });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'eventNotFound' });
  });

  it('reports eventNotFound for a soft-deleted event', async () => {
    seams.getEvent.mockResolvedValue({ id: EVENT_ID, deletedAt: new Date('2026-01-01') });

    const { isError, body } = await call([READ], 'get_event', { eventId: EVENT_ID });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'eventNotFound' });
  });

  it('returns full detail, including rrule, for a non-private event', async () => {
    decide.mockReturnValue('deny');
    seams.getEvent.mockResolvedValue({
      id: EVENT_ID,
      title: 'BSO',
      description: null,
      location: null,
      startsAt: new Date('2026-09-08T06:30:00.000Z'),
      endsAt: new Date('2026-09-08T13:30:00.000Z'),
      allDay: false,
      ownerMemberId: null,
      attendeeMemberIds: [],
      eventType: 'appointment',
      calendarId: null,
      rrule: 'FREQ=WEEKLY;BYDAY=TU,TH',
      googleEventId: null,
      deletedAt: null,
    });

    const { isError, body } = await call([READ], 'get_event', { eventId: EVENT_ID });

    expect(isError).toBe(false);
    expect(dbSelect).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      eventId: EVENT_ID,
      title: 'BSO',
      rrule: 'FREQ=WEEKLY;BYDAY=TU,TH',
      recurrence: 'weekly',
      byweekday: ['MO', 'TH'],
      busyOnly: false,
    });
  });

  it('redacts a private event the principal cannot see the detail of', async () => {
    decide.mockReturnValue('deny');
    mockCalendarRow({ visibility: 'private', ownerMemberId: 'someone-else' });
    seams.getEvent.mockResolvedValue({
      id: EVENT_ID,
      title: 'Therapie',
      startsAt: new Date('2026-09-08T06:30:00.000Z'),
      endsAt: new Date('2026-09-08T07:30:00.000Z'),
      allDay: false,
      calendarId: CALENDAR_ID,
      rrule: null,
      deletedAt: null,
    });

    const { isError, body } = await call([READ], 'get_event', { eventId: EVENT_ID });

    expect(isError).toBe(false);
    expect(body).toEqual({
      eventId: EVENT_ID,
      title: 'busy',
      startsAt: '2026-09-08T06:30:00.000Z',
      endsAt: '2026-09-08T07:30:00.000Z',
      allDay: false,
      recurring: false,
      busyOnly: true,
    });
  });

  it('lets the calendar’s own member read their own private event in full', async () => {
    const memberId = '22222222-2222-4222-8222-222222222222';
    decide.mockReturnValue('own');
    mockCalendarRow({ visibility: 'private', ownerMemberId: memberId });
    seams.getEvent.mockResolvedValue({
      id: EVENT_ID,
      title: 'Therapie',
      description: null,
      location: null,
      startsAt: new Date('2026-09-08T06:30:00.000Z'),
      endsAt: new Date('2026-09-08T07:30:00.000Z'),
      allDay: false,
      ownerMemberId: memberId,
      attendeeMemberIds: [],
      eventType: 'appointment',
      calendarId: CALENDAR_ID,
      rrule: null,
      googleEventId: null,
      deletedAt: null,
    });

    const { isError, body } = await call([READ], 'get_event', { eventId: EVENT_ID });

    expect(isError).toBe(false);
    expect(body).toMatchObject({ title: 'Therapie', busyOnly: false });
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

/**
 * `update_event` and `delete_event` (the "whole event/whole series" tools,
 * distinct from the occurrence-scoped `update_event_occurrence` /
 * `skip_event_occurrence` above) share the same ladder: scope, then
 * `can('event:write')`, then a Google-sync check via `getEvent`, then the
 * seam. Unlike the occurrence tools, a Google-linked event is refused
 * outright rather than passed through — an MCP-only restriction layered in
 * `calendar.ts` itself (`googleSyncCheck`), not in the shared write seam.
 */
describe('update_event', () => {
  it('refuses a token without kynite:calendar.write', async () => {
    const { isError, body } = await call([READ], 'update_event', { eventId: EVENT_ID });

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.updateEvent).not.toHaveBeenCalled();
  });

  it('refuses a member whose role cannot write events', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'update_event', { eventId: EVENT_ID });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(can).toHaveBeenCalledWith(principal, 'event:write', { familyId: FAMILY_ID });
    expect(seams.updateEvent).not.toHaveBeenCalled();
  });

  it('refuses an event synced from Google Calendar', async () => {
    can.mockReturnValue(true);
    seams.getEvent.mockResolvedValue({ id: EVENT_ID, googleEventId: 'g_evt_1' });

    const { isError, body } = await call([WRITE], 'update_event', {
      eventId: EVENT_ID,
      title: 'Zwemles',
    });

    expect(isError).toBe(true);
    expect(body.error).toContain('googleSynced');
    expect(seams.getEvent).toHaveBeenCalledWith(FAMILY_ID, EVENT_ID);
    expect(seams.updateEvent).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    can.mockReturnValue(true);
    seams.getEvent.mockResolvedValue({ id: EVENT_ID, googleEventId: null });
    seams.updateEvent.mockResolvedValue({ ok: false, error: 'eventNotFound' });

    const { isError, body } = await call([WRITE], 'update_event', { eventId: EVENT_ID });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'eventNotFound' });
  });

  it('moves/edits a native event through the seam', async () => {
    can.mockReturnValue(true);
    seams.getEvent.mockResolvedValue({ id: EVENT_ID, googleEventId: null });
    seams.updateEvent.mockResolvedValue({ ok: true, eventId: EVENT_ID });

    const input = { eventId: EVENT_ID, title: 'Zwemles', allDay: false };
    const { isError, body } = await call([WRITE], 'update_event', input);

    expect(isError).toBe(false);
    expect(seams.updateEvent).toHaveBeenCalledWith(principal, input);
    expect(body).toEqual({ eventId: EVENT_ID });
  });
});

describe('delete_event', () => {
  it('refuses a token without kynite:calendar.write', async () => {
    const { isError, body } = await call([READ], 'delete_event', { eventId: EVENT_ID });

    expect(isError).toBe(true);
    expect(body.error).toContain('insufficientScope');
    expect(seams.deleteEvent).not.toHaveBeenCalled();
  });

  it('refuses a member whose role cannot write events', async () => {
    can.mockReturnValue(false);

    const { isError, body } = await call([WRITE], 'delete_event', { eventId: EVENT_ID });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'forbidden' });
    expect(can).toHaveBeenCalledWith(principal, 'event:write', { familyId: FAMILY_ID });
    expect(seams.deleteEvent).not.toHaveBeenCalled();
  });

  it('refuses an event synced from Google Calendar', async () => {
    can.mockReturnValue(true);
    seams.getEvent.mockResolvedValue({ id: EVENT_ID, googleEventId: 'g_evt_1' });

    const { isError, body } = await call([WRITE], 'delete_event', { eventId: EVENT_ID });

    expect(isError).toBe(true);
    expect(body.error).toContain('googleSynced');
    expect(seams.getEvent).toHaveBeenCalledWith(FAMILY_ID, EVENT_ID);
    expect(seams.deleteEvent).not.toHaveBeenCalled();
  });

  it('passes the seam’s refusal through as a tool error', async () => {
    can.mockReturnValue(true);
    seams.getEvent.mockResolvedValue({ id: EVENT_ID, googleEventId: null });
    seams.deleteEvent.mockResolvedValue({ ok: false, error: 'eventNotFound' });

    const { isError, body } = await call([WRITE], 'delete_event', { eventId: EVENT_ID });

    expect(isError).toBe(true);
    expect(body).toEqual({ error: 'eventNotFound' });
  });

  it('deletes a native event through the seam', async () => {
    can.mockReturnValue(true);
    seams.getEvent.mockResolvedValue({ id: EVENT_ID, googleEventId: null });
    seams.deleteEvent.mockResolvedValue({ ok: true });

    const { isError, body } = await call([WRITE], 'delete_event', { eventId: EVENT_ID });

    expect(isError).toBe(false);
    expect(seams.deleteEvent).toHaveBeenCalledWith(principal, EVENT_ID);
    expect(body).toEqual({ deleted: true });
  });
});
