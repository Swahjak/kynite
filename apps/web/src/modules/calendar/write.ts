import 'server-only';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/server/db';
// Table objects come from the schema assembly point, not from the owning
// slice's barrel — same note as `./actions.ts`.
import { calendar } from '@/server/db/schema';
import { can, getFamily, getMember, type Principal } from '@/modules/family';
import { publish } from '@/modules/realtime';
import { RECURRENCE_PRESETS, ruleForPreset, ruleForWeeklySelection } from './domain/presets';
import { WEEKDAYS } from './domain/rrule';
import { fromWall, parseDateKey } from './domain/zone';
import { EVENT_TYPES, event } from './schema';
import { pushToGoogle } from './sync-bridge';

/**
 * The write seam for the calendar slice (MCP milestone M-B).
 *
 * `createEvent(principal, input)` is `recordCompletion`'s shape
 * (`modules/routines/complete.ts`): an explicit `Principal` rather than an
 * ambient session, its own `can()` check inside the seam (redundant with the
 * action wrapper's `assertCan` by design — see that function's doc comment on
 * why a shared write checks for itself rather than trusting every future
 * caller to remember), and no `next/cache` import, so a future `/api/mcp`
 * route can call it exactly as a Server Action does. `input` is a plain,
 * already-typed object (`CreateEventInput`) rather than `FormData` — a route
 * handler receiving JSON has no form to build one from, and `eventSchema`
 * validates it the same way either caller arrives.
 *
 * `resolveInput` and its helpers moved here too, verbatim, because
 * `updateEventAction` still needs the identical parsed-input → row-values
 * mapping — one function, two callers, per architecture.md §2's shared write
 * path. Only `createEvent` is the seam `/api/mcp` will call; update and delete
 * stay Server-Action-only for this milestone.
 */

const trimmed = z.string().trim();

/** `2026-03-02T08:30` from a `datetime-local`, or `2026-03-02` when all-day. */
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export const eventSchema = z
  .object({
    title: trimmed.min(1).max(200),
    description: trimmed.max(4000).optional().or(z.literal('')),
    location: trimmed.max(400).optional().or(z.literal('')),
    startsAt: trimmed.min(1),
    endsAt: trimmed.min(1),
    allDay: z.boolean(),
    ownerMemberId: z.uuid().optional().or(z.literal('')),
    attendeeMemberIds: z.array(z.uuid()).max(50),
    eventType: z.enum(EVENT_TYPES),
    calendarId: z.uuid().optional().or(z.literal('')),
    recurrence: z.enum(RECURRENCE_PRESETS),
    // Weekday chips (Google-Calendar-style) for the `weekly` preset only — see
    // `resolveInput` below. Not a general RRULE input: every other preset
    // still authors its rule from `ruleForPreset` alone.
    byweekday: z.array(z.enum(WEEKDAYS)).min(1).max(7).optional(),
  })
  .refine((value) => (value.allDay ? true : LOCAL_DATE_TIME.test(value.startsAt)), {
    path: ['startsAt'],
  });

/** The validated shape `resolveInput` works from — either caller's endpoint. */
export type EventInput = z.infer<typeof eventSchema>;

/** The raw (pre-validation) shape `createEvent` accepts — same fields, untrusted. */
export type CreateEventInput = z.input<typeof eventSchema>;

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/** A create/update form → the raw shape `eventSchema` validates. */
export function eventInputFromForm(formData: FormData): z.ZodSafeParseResult<EventInput> {
  const byweekday = formData
    .getAll('byweekday')
    .filter((value): value is string => typeof value === 'string' && value !== '');

  return eventSchema.safeParse({
    title: read(formData, 'title'),
    description: read(formData, 'description'),
    location: read(formData, 'location'),
    startsAt: read(formData, 'startsAt'),
    endsAt: read(formData, 'endsAt'),
    allDay: formData.get('allDay') === 'on' || formData.get('allDay') === 'true',
    ownerMemberId: read(formData, 'ownerMemberId'),
    attendeeMemberIds: formData
      .getAll('attendeeMemberIds')
      .filter((value): value is string => typeof value === 'string' && value !== ''),
    eventType: read(formData, 'eventType'),
    calendarId: read(formData, 'calendarId'),
    recurrence: read(formData, 'recurrence') || 'none',
    byweekday: byweekday.length > 0 ? byweekday : undefined,
  });
}

/**
 * A form's local date/time → an instant in the family's zone.
 *
 * All-day values are stored as UTC midnights, matching M05's mapper: an
 * all-day event is a *date*, and giving it a zone is what makes it drift.
 */
function toInstant(value: string, timeZone: string, allDay: boolean): Date | null {
  if (allDay) {
    const wall = parseDateKey(value.slice(0, 10));
    if (!wall) return null;
    return new Date(Date.UTC(wall.year, wall.month - 1, wall.day));
  }

  const match = LOCAL_DATE_TIME.exec(value);
  if (!match) return null;

  return fromWall(
    {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: Number(match[4]),
      minute: Number(match[5]),
      second: 0,
    },
    timeZone
  );
}

export type Resolved = {
  familyId: string;
  timeZone: string;
  /** Kept alongside the values so `update` can honour the `custom` case. */
  recurrence: EventInput['recurrence'];
  values: {
    title: string;
    description: string | null;
    location: string | null;
    startsAt: Date;
    endsAt: Date;
    allDay: boolean;
    tz: string;
    ownerMemberId: string | null;
    attendeeMemberIds: string[];
    eventType: (typeof EVENT_TYPES)[number];
    calendarId: string | null;
    rrule: string | null;
  };
};

/**
 * Validated input → row values, with the checks a form (or a JSON caller)
 * cannot make itself: the calendar must belong to this family and be
 * writable, the event must not end before it starts, and
 * `ownerMemberId`/`attendeeMemberIds` must each name a member of this family
 * (B3) — an id is just what the caller sent, and a forged one must not
 * address another family's member.
 */
export async function resolveInput(
  familyId: string,
  input: EventInput
): Promise<{ ok: true; resolved: Resolved } | { ok: false; error: string }> {
  const family = await getFamily(familyId);
  const timeZone = family?.timezone ?? 'Europe/Amsterdam';

  const startsAt = toInstant(input.startsAt, timeZone, input.allDay);
  const endsAt = toInstant(input.endsAt, timeZone, input.allDay);
  if (!startsAt || !endsAt) return { ok: false, error: 'invalidInput' };
  if (endsAt.getTime() < startsAt.getTime()) return { ok: false, error: 'endBeforeStart' };

  let calendarId: string | null = null;
  if (input.calendarId) {
    const [row] = await getDb()
      .select({ id: calendar.id, writable: calendar.writable })
      .from(calendar)
      .where(and(eq(calendar.id, input.calendarId), eq(calendar.familyId, familyId)))
      .limit(1);

    if (!row) return { ok: false, error: 'calendarNotFound' };
    // A read-only Google calendar cannot take our writes; storing the event
    // against it would guarantee a push failure and a permanent pip.
    if (!row.writable) return { ok: false, error: 'calendarReadOnly' };
    calendarId = row.id;
  }

  // B3: `ownerMemberId`/`attendeeMemberIds` are ids the caller supplied,
  // exactly like `calendarId` above — so they get the same re-scoping.
  // `getMember` returns null for an id that exists but belongs to another
  // family, which is what turns a forged cross-family id into a rejection
  // instead of a silent cross-tenant write.
  if (input.ownerMemberId && !(await getMember(familyId, input.ownerMemberId))) {
    return { ok: false, error: 'memberNotFound' };
  }
  for (const attendeeMemberId of input.attendeeMemberIds) {
    if (!(await getMember(familyId, attendeeMemberId))) {
      return { ok: false, error: 'memberNotFound' };
    }
  }

  return {
    ok: true,
    resolved: {
      familyId,
      timeZone,
      recurrence: input.recurrence,
      values: {
        title: input.title,
        description: input.description || null,
        location: input.location || null,
        startsAt,
        endsAt,
        allDay: input.allDay,
        tz: timeZone,
        ownerMemberId: input.ownerMemberId || null,
        attendeeMemberIds: input.attendeeMemberIds,
        eventType: input.eventType,
        calendarId,
        rrule:
          input.recurrence === 'weekly'
            ? ruleForWeeklySelection(input.byweekday, startsAt, timeZone)
            : ruleForPreset(input.recurrence),
      },
    },
  };
}

/**
 * The realtime `actor` for a principal. A `member` principal names itself; a
 * paired kiosk names its device (M12). Neither is invented from a form.
 */
export function actorOf(principal: Principal): { memberId?: string; deviceId?: string } {
  if (principal.kind === 'member') return { memberId: principal.memberId };
  if (principal.kind === 'device') return { deviceId: principal.deviceId };
  return {};
}

/**
 * `event.upserted` for a single freshly-created id. `./actions.ts` keeps its
 * own `publishEvent` for the update/delete flavours (which fan out over more
 * than one id and can emit `event.deleted`); this is the narrower thing
 * `createEvent` alone needs.
 */
async function publishCreated(principal: Principal, eventId: string): Promise<void> {
  await publish({
    familyId: principal.familyId,
    type: 'event.upserted',
    entity: { id: eventId },
    actor: { ...actorOf(principal), source: 'mobile' },
  });
}

export type CreateEventResult = { ok: true; eventId: string } | { ok: false; error: string };

/**
 * Create an event for `principal`, outside of any Server Action.
 *
 * Same discipline as `recordCompletion`: `can()` is checked *inside* the seam
 * against the passed-in principal, not read off an ambient session, so a
 * future `/api/mcp` route reaches identical authorization to
 * `createEventAction` without going through `assertCan`'s
 * cookie/session resolution. `resolveInput` above already confines every id in
 * `input` (calendar, owner, attendees) to `principal.familyId` — a forged
 * cross-family id resolves to nothing rather than to a write across the
 * boundary.
 *
 * Pure of `next/cache`: revalidation is a caller concern (`./actions.ts` does
 * it for the web app; a future MCP route would not, since there is no page to
 * revalidate). The Google push and the realtime publish are not deferred to
 * the caller — they are as much a part of "the event now exists" as the row
 * itself, matching `createEventAction`'s existing order exactly.
 */
export async function createEvent(
  principal: Principal,
  input: CreateEventInput
): Promise<CreateEventResult> {
  if (!can(principal, 'event:write', { familyId: principal.familyId })) {
    return { ok: false, error: 'forbidden' };
  }

  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };

  const resolved = await resolveInput(principal.familyId, parsed.data);
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const [created] = await getDb()
    .insert(event)
    .values({ familyId: principal.familyId, ...resolved.resolved.values })
    .returning({ id: event.id });

  await publishCreated(principal, created.id);
  await pushToGoogle(created.id);

  return { ok: true, eventId: created.id };
}
