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
  deleteEvent,
  EVENT_TYPES,
  getEvent,
  listEvents,
  skipEventOccurrence,
  updateEvent,
  updateEventOccurrence,
  type CreateEventInput,
  type UpdateEventInput,
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

/**
 * Whether `eventId` names an event this MCP tool may move/edit/delete as a
 * whole. Unlike `skip_event_occurrence`/`update_event_occurrence` — which
 * treat a Google-authored series as a passthrough, same as the app itself —
 * a *whole-event* move/edit/delete from an MCP host is refused outright when
 * the event is linked to Google (`googleEventId` set): overwriting or
 * deleting the row locally would fight the next poll from Google, which owns
 * that event's identity. This is an MCP-only restriction the web app does
 * not have (it edits/deletes a Google-linked event and pushes the change
 * back), so the check lives here rather than in the shared `write.ts` seam.
 */
async function googleSyncCheck(
  familyId: string,
  eventId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await getEvent(familyId, eventId);
  if (existing?.googleEventId) {
    return {
      ok: false,
      error:
        'googleSynced: this event is synced from Google Calendar — change it in Google Calendar',
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
        'passthrough, not a restriction here. For a one-off event, or to delete the whole ' +
        'series, use `delete_event`.',
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
        'Google too, same as `skip_event_occurrence`. For a one-off event, or to move/edit ' +
        'the whole series, use `update_event`.',
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

  server.registerTool(
    'update_event',
    {
      title: 'Move or edit an event',
      description:
        'Move or edit a whole event — a one-off event, or every occurrence of a recurring ' +
        'series at once. Every field but `eventId` is optional: only the fields given are ' +
        'changed, everything else is left as it is. For one occurrence of a recurring ' +
        'series, use `update_event_occurrence` instead. Refuses an event synced from Google ' +
        'Calendar — change that one in Google Calendar.',
      inputSchema: z.object({
        eventId: z.uuid(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(4000).nullable().optional(),
        location: z.string().max(400).nullable().optional(),
        startsAt: z.iso.datetime({ offset: true }).optional(),
        endsAt: z.iso.datetime({ offset: true }).optional(),
        allDay: z.boolean().optional(),
        ownerMemberId: z.uuid().nullable().optional(),
        attendeeMemberIds: z.array(z.uuid()).max(50).optional(),
        eventType: z.enum(EVENT_TYPES).optional(),
        calendarId: z.uuid().nullable().optional(),
        recurrence: z.enum(RECURRENCE_PRESETS).optional(),
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

      const { eventId } = input as UpdateEventInput;
      const syncCheck = await googleSyncCheck(principal.familyId, eventId);
      if (!syncCheck.ok) return toolError(syncCheck.error);

      const result = await updateEvent(principal, input as UpdateEventInput);
      if (!result.ok) return toolError(result.error);
      return ok({ eventId: result.eventId });
    }
  );

  server.registerTool(
    'delete_event',
    {
      title: 'Delete an event',
      description:
        'Delete a whole event — a one-off event, or an entire recurring series (every ' +
        'occurrence, past and future). For a single occurrence of a recurring event, use ' +
        '`skip_event_occurrence` instead. Refuses an event synced from Google Calendar — ' +
        'change that one in Google Calendar.',
      inputSchema: z.object({
        eventId: z.uuid(),
      }),
    },
    async ({ eventId }) => {
      if (!hasAllScopes(grantedScopes, [MCP_CALENDAR_WRITE])) {
        return toolError('insufficientScope: requires kynite:calendar.write');
      }
      if (!can(principal, 'event:write', { familyId: principal.familyId })) {
        return toolError('forbidden');
      }

      const syncCheck = await googleSyncCheck(principal.familyId, eventId);
      if (!syncCheck.ok) return toolError(syncCheck.error);

      const result = await deleteEvent(principal, eventId);
      if (!result.ok) return toolError(result.error);
      return ok({ deleted: true });
    }
  );
}
