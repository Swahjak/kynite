import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/server/db';
// Table objects come from the schema assembly point, not from the owning
// slice's barrel — same note as `./actions.ts`.
import { calendar } from '@/server/db/schema';
import { can, getFamily, getMember, type Principal } from '@/modules/family';
import { publish } from '@/modules/realtime';
import { addExdate, exdateLine } from './domain/ical';
import {
  RECURRENCE_PRESETS,
  preservesExistingRule,
  ruleForPreset,
  ruleForWeeklySelection,
} from './domain/presets';
import { WEEKDAYS, type Weekday } from './domain/rrule';
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
 * path.
 *
 * M-E adds `skipEventOccurrence` and `updateEventOccurrence`: the two
 * occurrence-scoped seams, extracted from what used to be inlined in
 * `deleteEventAction`'s and `updateEventAction`'s `scope === 'occurrence'`
 * branches (`./actions.ts`). Same discipline as `createEvent` — those two
 * Server Actions are now thin wrappers over these, and `/api/mcp` reaches the
 * identical write path. Whole-series editing/deleting/rescheduling stays
 * inlined in `./actions.ts`; only the per-occurrence override shape moved.
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

/**
 * `event.upserted` for one or more ids, the flavour `updateEventAction`,
 * `deleteEventAction` and `rescheduleEventAction` all fan out over (a parent
 * gaining an EXDATE and a child override are two separate facts for a
 * client). `./actions.ts` keeps its own copy of this — unchanged by this
 * milestone — for the whole-series branches that still live there; the
 * occurrence seams below use this one so both callers publish identically.
 */
async function publishEvent(
  principal: Principal,
  type: 'event.upserted' | 'event.deleted',
  eventIds: readonly string[]
): Promise<void> {
  for (const id of eventIds) {
    await publish({
      familyId: principal.familyId,
      type,
      entity: { id },
      actor: { ...actorOf(principal), source: 'mobile' },
    });
  }
}

export type SkipEventOccurrenceInput = {
  eventId: string;
  /** ISO instant identifying which occurrence of the series to suppress. */
  occurrenceStart: string;
};

export type SkipEventOccurrenceResult = { ok: true } | { ok: false; error: string };

/**
 * Suppress one occurrence of a recurring series — the write seam behind
 * `deleteEventAction`'s `scope === 'occurrence'` branch (M-E). Mirrors it
 * exactly: an EXDATE appended to the *parent*, no row deleted, the series
 * still an upsert from a client's point of view (every other instance
 * survives), same Google push.
 *
 * Deliberately does not special-case a Google-synced calendar: neither does
 * `deleteEventAction` — `pushToGoogle` (`pushEventWithRetry`) already treats
 * an unsyncable/foreign calendar as a no-op `'skipped'` outcome rather than a
 * failure, so refusing here would be a restriction the web app itself does
 * not have. An EXDATE against a Google-authored series is exactly the
 * passthrough `domain/ical.ts`'s `exdateLine` is built to produce.
 */
export async function skipEventOccurrence(
  principal: Principal,
  input: SkipEventOccurrenceInput
): Promise<SkipEventOccurrenceResult> {
  if (!can(principal, 'event:write', { familyId: principal.familyId })) {
    return { ok: false, error: 'forbidden' };
  }

  const instant = new Date(input.occurrenceStart);
  if (Number.isNaN(instant.getTime())) return { ok: false, error: 'invalidInput' };

  const db = getDb();
  const [existing] = await db
    .select()
    .from(event)
    .where(and(eq(event.id, input.eventId), eq(event.familyId, principal.familyId)))
    .limit(1);

  // Same shape as `deleteEventAction`: `!existing` alone, no `deletedAt`
  // check — a soft-deleted series has no further occurrences to skip, but
  // failing loudly here isn't the action's behaviour either, so this seam
  // keeps parity rather than inventing a stricter check.
  if (!existing) return { ok: false, error: 'eventNotFound' };
  if (!existing.rrule) return { ok: false, error: 'notRecurring' };

  await db
    .update(event)
    .set({
      exdates: addExdate(existing.exdates, exdateLine(instant, existing.tz, existing.allDay)),
      version: sql`${event.version} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(event.id, existing.id), eq(event.familyId, principal.familyId)));

  await publishEvent(principal, 'event.upserted', [existing.id]);
  await pushToGoogle(existing.id);

  return { ok: true };
}

export type UpdateEventOccurrenceInput = {
  eventId: string;
  /** ISO instant identifying which occurrence of the series to override. */
  occurrenceStart: string;
  /**
   * A patch over the *parent* series' current values, so a caller only
   * states what changes — any field left `undefined` is carried over from
   * `existing`, `startsAt`/`endsAt` defaulting to the occurrence's own slot
   * (same duration as the parent). This is what makes the same seam serve
   * two very different callers unchanged:
   *
   * - `updateEventAction`'s occurrence branch (`./actions.ts`) is a thin
   *   wrapper that passes *every* field explicitly — the dialog form always
   *   submits the full set (owner, attendees, type, calendar, all-day-ness
   *   included), pre-filled from the existing event the way `EventDialog`
   *   does — so nothing here is ever defaulted for that caller and behaviour
   *   is byte-for-byte what the inlined branch used to do.
   * - The MCP tool (`skip_event_occurrence`'s sibling in `route.ts`) has no
   *   such form to prefill from, so its schema exposes only
   *   `startsAt`/`endsAt`/`title`/`location`/`description` — the task's
   *   "don't invent more" — and leaves owner/attendees/type/calendar/all-day
   *   to default from the parent. A caller that needs to change one of those
   *   on a single occurrence still has to go through the app.
   */
  startsAt?: string;
  endsAt?: string;
  title?: string;
  location?: string | null;
  description?: string | null;
  ownerMemberId?: string | null;
  attendeeMemberIds?: string[];
  eventType?: (typeof EVENT_TYPES)[number];
  calendarId?: string | null;
  allDay?: boolean;
};

export type UpdateEventOccurrenceResult =
  | { ok: true; eventId: string; occurrenceEventId: string }
  | { ok: false; error: string };

/**
 * Override one occurrence of a recurring series — the write seam behind
 * `updateEventAction`'s `scope === 'occurrence'` branch (M-E). Mirrors its
 * mechanics byte-for-byte: a single transaction inserts the child override
 * row (`recurrenceParentId` → parent, `rrule: null`) and appends the parent's
 * EXDATE for the replaced slot, then both rows publish and push to Google —
 * the parent's new EXDATE and the child override are two separate facts for
 * a client, same as the action.
 *
 * The child's `tz` is the family's *current* timezone (`getFamily`, the same
 * source `resolveInput` reads), not `existing.tz` — the inlined branch this
 * replaces built the child from `input.resolved.values`, which always came
 * from a fresh `resolveInput` call, so a family that changed timezone since
 * the parent series was created got the new zone on every occurrence
 * override, not the parent's stale one. Reading `existing.tz` here would be
 * a quiet divergence from that.
 *
 * Same Google-sync stance as `skipEventOccurrence` above: `updateEventAction`
 * does not refuse a synced calendar's occurrence edit either, so neither does
 * this.
 */
export async function updateEventOccurrence(
  principal: Principal,
  input: UpdateEventOccurrenceInput
): Promise<UpdateEventOccurrenceResult> {
  if (!can(principal, 'event:write', { familyId: principal.familyId })) {
    return { ok: false, error: 'forbidden' };
  }

  const instant = new Date(input.occurrenceStart);
  if (Number.isNaN(instant.getTime())) return { ok: false, error: 'invalidInput' };

  const db = getDb();
  const [existing] = await db
    .select()
    .from(event)
    .where(and(eq(event.id, input.eventId), eq(event.familyId, principal.familyId)))
    .limit(1);

  // `updateEventAction` refuses a soft-deleted event outright — the same
  // check applies here.
  if (!existing || existing.deletedAt) return { ok: false, error: 'eventNotFound' };
  if (!existing.rrule) return { ok: false, error: 'notRecurring' };

  const family = await getFamily(principal.familyId);
  const tz = family?.timezone ?? 'Europe/Amsterdam';

  const startsAt = input.startsAt ? new Date(input.startsAt) : instant;
  if (Number.isNaN(startsAt.getTime())) return { ok: false, error: 'invalidInput' };

  const seriesDurationMs = existing.endsAt.getTime() - existing.startsAt.getTime();
  const endsAt = input.endsAt
    ? new Date(input.endsAt)
    : new Date(startsAt.getTime() + seriesDurationMs);
  if (Number.isNaN(endsAt.getTime())) return { ok: false, error: 'invalidInput' };
  if (endsAt.getTime() < startsAt.getTime()) return { ok: false, error: 'endBeforeStart' };

  const title = input.title !== undefined ? input.title.trim() : existing.title;
  if (title.length === 0) return { ok: false, error: 'invalidInput' };

  const childId = await db.transaction(async (tx) => {
    const [child] = await tx
      .insert(event)
      .values({
        familyId: principal.familyId,
        title,
        description:
          input.description !== undefined ? input.description || null : existing.description,
        location: input.location !== undefined ? input.location || null : existing.location,
        startsAt,
        endsAt,
        allDay: input.allDay ?? existing.allDay,
        tz,
        ownerMemberId:
          input.ownerMemberId !== undefined ? input.ownerMemberId || null : existing.ownerMemberId,
        attendeeMemberIds: input.attendeeMemberIds ?? existing.attendeeMemberIds,
        eventType: input.eventType ?? existing.eventType,
        calendarId: input.calendarId !== undefined ? input.calendarId || null : existing.calendarId,
        // The override is a single instance, never a series of its own.
        rrule: null,
        recurrenceParentId: existing.id,
      })
      .returning({ id: event.id });

    await tx
      .update(event)
      .set({
        exdates: addExdate(existing.exdates, exdateLine(instant, existing.tz, existing.allDay)),
        version: sql`${event.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(event.id, existing.id), eq(event.familyId, principal.familyId)));

    return child.id;
  });

  await publishEvent(principal, 'event.upserted', [existing.id, childId]);
  await pushToGoogle(existing.id);
  await pushToGoogle(childId);

  return { ok: true, eventId: existing.id, occurrenceEventId: childId };
}

/**
 * Whichever field of {@link updateEvent}'s input is left `undefined` carries
 * over from the existing row unchanged — same "patch, not replace" contract as
 * {@link UpdateEventOccurrenceInput}. Unlike that occurrence override,
 * `startsAt`/`endsAt` here move the *whole* event (or the whole series when
 * it recurs) rather than splitting off a child row.
 */
export type UpdateEventInput = {
  eventId: string;
  title?: string;
  description?: string | null;
  location?: string | null;
  /** ISO instant. */
  startsAt?: string;
  /** ISO instant. */
  endsAt?: string;
  allDay?: boolean;
  ownerMemberId?: string | null;
  attendeeMemberIds?: string[];
  eventType?: (typeof EVENT_TYPES)[number];
  calendarId?: string | null;
  recurrence?: (typeof RECURRENCE_PRESETS)[number];
  byweekday?: Weekday[];
};

export type UpdateEventResult = { ok: true; eventId: string } | { ok: false; error: string };

/**
 * Move/edit the whole event — a one-off event outright, or every occurrence
 * of a recurring series at once (the MCP tool behind this,
 * `update_event`, is what a host reaches for when `update_event_occurrence`
 * doesn't apply because the event isn't recurring, or the host wants the
 * change to land on the whole series rather than one instance).
 *
 * Deliberately does not special-case a Google-synced event: neither does
 * `updateEventAction`'s pre-M-F whole-series branch this replaces — the app
 * lets a parent edit a Google-linked event and pushes the change back
 * (`pushToGoogle`), same passthrough stance as `updateEventOccurrence`. A
 * caller that wants to refuse Google-synced events (the `update_event` MCP
 * tool does) checks that itself before reaching this seam.
 */
export async function updateEvent(
  principal: Principal,
  input: UpdateEventInput
): Promise<UpdateEventResult> {
  if (!can(principal, 'event:write', { familyId: principal.familyId })) {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(event)
    .where(and(eq(event.id, input.eventId), eq(event.familyId, principal.familyId)))
    .limit(1);

  if (!existing || existing.deletedAt) return { ok: false, error: 'eventNotFound' };

  const title = input.title !== undefined ? input.title.trim() : existing.title;
  if (title.length === 0) return { ok: false, error: 'invalidInput' };

  const allDay = input.allDay ?? existing.allDay;
  // `existing.startsAt`/`endsAt` are stored to match `existing.allDay` — a
  // timed instant, or a UTC midnight (`toInstant`'s all-day convention above).
  // Flipping `allDay` without supplying both dates would carry one of those
  // shapes forward under the *other* meaning (a UTC-midnight `Date` read as a
  // timed instant, or vice versa), so that combination is refused rather than
  // silently breaking the invariant.
  if (input.allDay !== undefined && input.allDay !== existing.allDay) {
    if (input.startsAt === undefined || input.endsAt === undefined) {
      return { ok: false, error: 'invalidInput' };
    }
  }

  const startsAt = input.startsAt !== undefined ? new Date(input.startsAt) : existing.startsAt;
  if (Number.isNaN(startsAt.getTime())) return { ok: false, error: 'invalidInput' };
  const endsAt = input.endsAt !== undefined ? new Date(input.endsAt) : existing.endsAt;
  if (Number.isNaN(endsAt.getTime())) return { ok: false, error: 'invalidInput' };
  if (endsAt.getTime() < startsAt.getTime()) return { ok: false, error: 'endBeforeStart' };

  let calendarId = existing.calendarId;
  if (input.calendarId !== undefined) {
    if (input.calendarId === null) {
      calendarId = null;
    } else {
      const [row] = await db
        .select({ id: calendar.id, writable: calendar.writable })
        .from(calendar)
        .where(and(eq(calendar.id, input.calendarId), eq(calendar.familyId, principal.familyId)))
        .limit(1);
      if (!row) return { ok: false, error: 'calendarNotFound' };
      if (!row.writable) return { ok: false, error: 'calendarReadOnly' };
      calendarId = row.id;
    }
  }

  let ownerMemberId = existing.ownerMemberId;
  if (input.ownerMemberId !== undefined) {
    if (input.ownerMemberId === null) {
      ownerMemberId = null;
    } else {
      if (!(await getMember(principal.familyId, input.ownerMemberId))) {
        return { ok: false, error: 'memberNotFound' };
      }
      ownerMemberId = input.ownerMemberId;
    }
  }

  let attendeeMemberIds = existing.attendeeMemberIds;
  if (input.attendeeMemberIds !== undefined) {
    for (const id of input.attendeeMemberIds) {
      if (!(await getMember(principal.familyId, id))) {
        return { ok: false, error: 'memberNotFound' };
      }
    }
    attendeeMemberIds = input.attendeeMemberIds;
  }

  const family = await getFamily(principal.familyId);
  const tz = family?.timezone ?? 'Europe/Amsterdam';

  let rrule = existing.rrule;
  if (input.recurrence !== undefined || input.byweekday !== undefined) {
    // `byweekday` only means something for a `weekly` rule — default the
    // preset to `weekly` when only the days were given, and refuse a
    // combination that would otherwise silently drop the days (mirrors the
    // allDay/startsAt-endsAt guard above).
    const recurrence = input.recurrence ?? 'weekly';
    if (input.byweekday !== undefined && recurrence !== 'weekly') {
      return { ok: false, error: 'invalidInput' };
    }
    rrule = preservesExistingRule(recurrence)
      ? existing.rrule
      : recurrence === 'weekly'
        ? ruleForWeeklySelection(input.byweekday, startsAt, tz)
        : ruleForPreset(recurrence);
  }

  await db
    .update(event)
    .set({
      title,
      description:
        input.description !== undefined ? input.description || null : existing.description,
      location: input.location !== undefined ? input.location || null : existing.location,
      startsAt,
      endsAt,
      allDay,
      tz,
      ownerMemberId,
      attendeeMemberIds,
      eventType: input.eventType ?? existing.eventType,
      calendarId,
      rrule,
      version: sql`${event.version} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(event.id, existing.id), eq(event.familyId, principal.familyId)));

  await publishEvent(principal, 'event.upserted', [existing.id]);
  await pushToGoogle(existing.id);

  return { ok: true, eventId: existing.id };
}

export type DeleteEventResult = { ok: true } | { ok: false; error: string };

/**
 * Delete the whole event — a one-off event outright, or an entire recurring
 * series (every occurrence, past and future). For a single occurrence of a
 * series, use {@link skipEventOccurrence} instead; this seam always soft-
 * deletes the row itself, same mechanics as `deleteEventAction`'s whole-
 * series branch.
 *
 * Same Google-sync stance as {@link updateEvent}: this seam does not refuse a
 * linked event — `deleteEventAction`'s whole-series branch never has either.
 * The `delete_event` MCP tool checks that itself before reaching this seam.
 */
export async function deleteEvent(
  principal: Principal,
  eventId: string
): Promise<DeleteEventResult> {
  if (!can(principal, 'event:write', { familyId: principal.familyId })) {
    return { ok: false, error: 'forbidden' };
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(event)
    .where(and(eq(event.id, eventId), eq(event.familyId, principal.familyId)))
    .limit(1);

  if (!existing) return { ok: false, error: 'eventNotFound' };

  await db
    .update(event)
    .set({
      deletedAt: new Date(),
      version: sql`${event.version} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(event.id, existing.id), eq(event.familyId, principal.familyId)));

  await publishEvent(principal, 'event.deleted', [existing.id]);
  await pushToGoogle(existing.id);

  return { ok: true };
}
