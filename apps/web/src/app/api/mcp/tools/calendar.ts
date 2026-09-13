import 'server-only';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/server/db';
import { icsSubscription } from '@/server/db/schema';
import { MCP_CALENDAR_READ, MCP_CALENDAR_WRITE, hasAllScopes } from '@/server/mcp-auth';
import {
  RECURRENCE_PRESETS,
  WEEKDAYS,
  createEvent,
  EVENT_TYPES,
  listEvents,
  skipEventOccurrence,
  updateEventOccurrence,
  type CreateEventInput,
  type UpdateEventOccurrenceInput,
} from '@/modules/calendar';
import { type Calendar, listFamilyCalendars } from '@/modules/google';
import { can, decide, type Principal } from '@/modules/family';
import { ok, toolError, type McpToolServer } from './shared';

/** Whether `calendarId` names a calendar this MCP tool may write to. */
async function nativeCalendarCheck(
  familyId: string,
  calendarId: string | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!calendarId) return { ok: true };

  const calendars = await listFamilyCalendars(familyId);
  const row = calendars.find((c: Calendar) => c.id === calendarId);
  if (!row) return { ok: false, error: 'calendarNotFound' };
  if (row.googleAccountId) {
    return {
      ok: false,
      error:
        'nativeOnly: calendar is linked to Google — create_event only writes to native Kynite calendars',
    };
  }

  const [subscription] = await getDb()
    .select({ id: icsSubscription.id })
    .from(icsSubscription)
    .where(eq(icsSubscription.calendarId, calendarId))
    .limit(1);
  if (subscription) {
    return {
      ok: false,
      error:
        'nativeOnly: calendar is an ICS subscription — create_event only writes to native Kynite calendars',
    };
  }

  return { ok: true };
}

/** The calendar domain's MCP tools. See `./shared.ts` for the split. */
export function registerCalendarTools(
  server: McpToolServer,
  principal: Principal,
  grantedScopes: ReadonlySet<string>
): void {
  server.registerTool(
    'list_calendars',
    {
      title: 'List calendars',
      description:
        'List this family’s calendars, including whether each is a native Kynite calendar or backed by Google/ICS (read-only).',
      inputSchema: z.object({}),
    },
    async () => {
      if (!hasAllScopes(grantedScopes, [MCP_CALENDAR_READ])) {
        return toolError('insufficientScope: requires kynite:calendar.read');
      }
      const calendars = await listFamilyCalendars(principal.familyId);
      return ok(
        calendars.map((c) => ({
          id: c.id,
          summary: c.summary,
          native: c.googleAccountId === null,
          writable: c.writable,
          visibility: c.visibility,
        }))
      );
    }
  );

  server.registerTool(
    'list_events',
    {
      title: 'List events',
      description: 'List calendar events in a date range, optionally filtered to one member.',
      inputSchema: z.object({
        from: z.iso.datetime({ offset: true }).or(z.iso.date()),
        to: z.iso.datetime({ offset: true }).or(z.iso.date()),
        memberId: z.uuid().optional(),
      }),
    },
    async ({ from, to, memberId }) => {
      if (!hasAllScopes(grantedScopes, [MCP_CALENDAR_READ])) {
        return toolError('insufficientScope: requires kynite:calendar.read');
      }
      const privateGrade = decide(principal, 'calendar:view_private', {
        familyId: principal.familyId,
      });
      const privateDetail = privateGrade === 'allow';
      const privateDetailFor =
        privateGrade === 'own' && principal.kind === 'member' ? principal.memberId : null;

      const window = { from: new Date(from), to: new Date(to) };
      if (Number.isNaN(window.from.getTime()) || Number.isNaN(window.to.getTime())) {
        return toolError('invalidInput: from/to must be ISO dates or datetimes');
      }

      const events = await listEvents({
        familyId: principal.familyId,
        window,
        privateDetail,
        privateDetailFor,
      });
      const filtered = memberId
        ? events.filter(
            (e) => e.ownerMemberId === memberId || e.attendeeMemberIds.includes(memberId)
          )
        : events;

      return ok(
        filtered.map((e) => ({
          key: e.key,
          title: e.title,
          startsAt: e.startsAt.toISOString(),
          endsAt: e.endsAt.toISOString(),
          allDay: e.allDay,
          ownerMemberId: e.ownerMemberId,
          attendeeMemberIds: e.attendeeMemberIds,
          eventType: e.eventType,
          calendarId: e.calendarId,
          recurring: e.recurring,
          busyOnly: e.busyOnly,
        }))
      );
    }
  );

  server.registerTool(
    'create_event',
    {
      title: 'Create a calendar event',
      description:
        'Create an event on a native Kynite calendar. Refuses any calendarId backed by Google or an ICS subscription — use the app for those.',
      inputSchema: z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(4000).optional(),
        location: z.string().max(400).optional(),
        startsAt: z.string().min(1),
        endsAt: z.string().min(1),
        allDay: z.boolean(),
        ownerMemberId: z.uuid().optional(),
        attendeeMemberIds: z.array(z.uuid()).max(50).default([]),
        eventType: z.enum(EVENT_TYPES),
        calendarId: z.uuid().optional(),
        recurrence: z.enum(RECURRENCE_PRESETS),
        byweekday: z.array(z.enum(WEEKDAYS)).min(1).max(7).optional(),
      }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_CALENDAR_WRITE])) {
        return toolError('insufficientScope: requires kynite:calendar.write');
      }
      if (!can(principal, 'event:write', { familyId: principal.familyId })) {
        return toolError('forbidden');
      }

      const nativeCheck = await nativeCalendarCheck(principal.familyId, input.calendarId);
      if (!nativeCheck.ok) return toolError(nativeCheck.error);

      const result = await createEvent(principal, input as CreateEventInput);
      if (!result.ok) return toolError(result.error);
      return ok({ eventId: result.eventId });
    }
  );

  server.registerTool(
    'skip_event_occurrence',
    {
      title: 'Skip one occurrence of a recurring event',
      description:
        'Suppress a single occurrence of a recurring event — the series and every other ' +
        'occurrence survive. `eventId` and `occurrenceStart` come from a `list_events` ' +
        '`key` such as "d4526712-...:2026-09-07T06:20:00.000Z": the id is the part before ' +
        'the first ":", the occurrence start is the ISO datetime after it. Works on any ' +
        'series the family can edit, including one synced from Google — Google sync is a ' +
        'passthrough, not a restriction here.',
      inputSchema: z.object({
        eventId: z.uuid(),
        occurrenceStart: z.iso.datetime({ offset: true }),
      }),
    },
    async ({ eventId, occurrenceStart }) => {
      if (!hasAllScopes(grantedScopes, [MCP_CALENDAR_WRITE])) {
        return toolError('insufficientScope: requires kynite:calendar.write');
      }
      if (!can(principal, 'event:write', { familyId: principal.familyId })) {
        return toolError('forbidden');
      }

      const result = await skipEventOccurrence(principal, { eventId, occurrenceStart });
      if (!result.ok) return toolError(result.error);
      return ok({ skipped: true });
    }
  );

  server.registerTool(
    'update_event_occurrence',
    {
      title: 'Edit one occurrence of a recurring event',
      description:
        'Override a single occurrence of a recurring event without touching the series or ' +
        'its other occurrences. `eventId` and `occurrenceStart` come from a `list_events` ' +
        '`key` such as "d4526712-...:2026-09-07T06:20:00.000Z": the id is the part before ' +
        'the first ":", the occurrence start is the ISO datetime after it. Only ' +
        'startsAt/endsAt/title/location/description can be changed this way — anything else ' +
        'is carried over from the series (owner, attendees, type, calendar, all-day-ness); ' +
        'use the app to change those on a single occurrence. Works on a series synced from ' +
        'Google too, same as `skip_event_occurrence`.',
      inputSchema: z.object({
        eventId: z.uuid(),
        occurrenceStart: z.iso.datetime({ offset: true }),
        startsAt: z.iso.datetime({ offset: true }).optional(),
        endsAt: z.iso.datetime({ offset: true }).optional(),
        title: z.string().min(1).max(200).optional(),
        location: z.string().max(400).nullable().optional(),
        description: z.string().max(4000).nullable().optional(),
      }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_CALENDAR_WRITE])) {
        return toolError('insufficientScope: requires kynite:calendar.write');
      }
      if (!can(principal, 'event:write', { familyId: principal.familyId })) {
        return toolError('forbidden');
      }

      const result = await updateEventOccurrence(principal, input as UpdateEventOccurrenceInput);
      if (!result.ok) return toolError(result.error);
      return ok({ eventId: result.eventId, occurrenceEventId: result.occurrenceEventId });
    }
  );
}
