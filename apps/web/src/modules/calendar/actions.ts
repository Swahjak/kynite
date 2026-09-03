'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/server/db';
// Table objects come from the schema assembly point, not from the owning
// slice's barrel. `@/modules/google` re-exports that slice's client components,
// so importing it here would pull a React client graph into a `server-only`
// query module — and make this file unimportable from a plain Node test. The
// barrel is for *behaviour*; `server/db/schema.ts` is for tables (§2).
import { CALENDAR_VISIBILITIES, calendar } from '@/server/db/schema';
import { assertCan, type Principal } from '@/modules/family';
import { publish } from '@/modules/realtime';
import { actionFailure as failure, idleState, type ActionState } from './action-state';
import { preservesExistingRule } from './domain/presets';
import { addExdate, exdateLine } from './domain/ical';
import { EVENT_TYPES, event } from './schema';
import { pushToGoogle } from './sync-bridge';
import { createEvent, eventInputFromForm, resolveInput } from './write';

/**
 * Mutations for the calendar slice (M06).
 *
 * Every action follows the §2 discipline: authorize → validate → write in one
 * transaction → push to Google → revalidate. `assertCan('event:write')` is the
 * first statement in each, before any database identifier is referenced, which
 * is what `tests/unit/server-action-authorization.test.ts` audits structurally.
 *
 * Family scoping is not left to the capability check: every `where` clause
 * carries `familyId` from the *principal*, never from the form, so a forged id
 * addresses nothing.
 *
 * `createEventAction` is a thin wrapper over `./write.ts`'s `createEvent` —
 * the MCP-server write seam (M-B): authorize → parse the form → delegate the
 * actual write, insert, publish and Google push to the shared seam →
 * revalidate. `resolveInput` and the form→input parsing it shares with
 * `updateEventAction` live there too, verbatim, so the two Server Actions and
 * a future `/api/mcp` route all map a form (or JSON) to the same row values.
 */

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

async function revalidateCalendar(): Promise<void> {
  const locale = await getLocale();
  // Realtime is the mechanism that makes an edit on the phone appear on the
  // wall display within §4's 2s budget; this revalidation is what keeps the
  // *server-rendered* surfaces of the editing device itself correct on the
  // next navigation. Both, not either.
  for (const path of ['/calendar', '/today', '/hub']) {
    revalidatePath(`/${locale}${path}`);
  }
}

/**
 * The realtime `actor` for a principal. A `member` principal names itself; a
 * paired kiosk names its device (M12). Neither is invented from a form.
 */
function actorOf(principal: Principal): { memberId?: string; deviceId?: string } {
  if (principal.kind === 'member') return { memberId: principal.memberId };
  if (principal.kind === 'device') return { deviceId: principal.deviceId };
  return {};
}

/**
 * `event.upserted` / `event.deleted` from the *parent's* side (M10 retrofit).
 *
 * M05 already published these from the Google sync engine, which meant a
 * change made in Google reached the hub in seconds while a change made in
 * Kynite itself waited for a page load. These calls close that asymmetry: the
 * two paths now emit the same vocabulary, and a client cannot tell — nor need
 * to — whether an event changed because a parent edited it here or because it
 * arrived from Google.
 *
 * Published after the write rather than inside it, matching
 * `google/store.ts`'s emitter: each of these writes is a single statement (or
 * a transaction that has already committed), so there is no window in which a
 * broadcast could describe a row that never landed.
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

export async function createEventAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('event:write').catch(() => null);
  if (!principal) return failure('forbidden');

  const parsed = eventInputFromForm(formData);
  if (!parsed.success) return failure('invalidInput');

  const result = await createEvent(principal, parsed.data);
  if (!result.ok) return failure(result.error);

  await revalidateCalendar();
  return idleState;
}

export async function updateEventAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('event:write').catch(() => null);
  if (!principal) return failure('forbidden');

  const eventId = read(formData, 'eventId');
  if (!z.uuid().safeParse(eventId).success) return failure('invalidInput');

  const parsedForm = eventInputFromForm(formData);
  if (!parsedForm.success) return failure('invalidInput');

  const input = await resolveInput(principal.familyId, parsedForm.data);
  if (!input.ok) return failure(input.error);

  const db = getDb();
  const [existing] = await db
    .select()
    .from(event)
    .where(and(eq(event.id, eventId), eq(event.familyId, principal.familyId)))
    .limit(1);

  if (!existing || existing.deletedAt) return failure('eventNotFound');

  // "This occurrence only" on a series: the parent gains an EXDATE and a child
  // row takes the edit (docs/architecture.md §3). That is the shape Google
  // uses, so the push is a passthrough rather than a translation.
  const scope = read(formData, 'scope');
  const occurrenceStart = read(formData, 'occurrenceStart');

  if (scope === 'occurrence' && existing.rrule && occurrenceStart) {
    const instant = new Date(occurrenceStart);
    if (Number.isNaN(instant.getTime())) return failure('invalidInput');

    const childId = await db.transaction(async (tx) => {
      const [child] = await tx
        .insert(event)
        .values({
          familyId: principal.familyId,
          ...input.resolved.values,
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

    // Both rows changed, so both push — and both broadcast: the parent's new
    // EXDATE and the child override are two separate facts for a client.
    await publishEvent(principal, 'event.upserted', [existing.id, childId]);
    await pushToGoogle(existing.id);
    await pushToGoogle(childId);
    await revalidateCalendar();
    return idleState;
  }

  await db
    .update(event)
    .set({
      ...input.resolved.values,
      // An imported rule we did not author (`custom`) is preserved verbatim:
      // the dialog cannot represent it, so it must not get to overwrite it.
      // Same reasoning as M05's verbatim storage — a rule we cannot round-trip
      // is a rule we must not touch.
      ...(preservesExistingRule(input.resolved.recurrence) ? { rrule: existing.rrule } : {}),
      version: sql`${event.version} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(event.id, eventId), eq(event.familyId, principal.familyId)));

  await publishEvent(principal, 'event.upserted', [eventId]);
  await pushToGoogle(eventId);
  await revalidateCalendar();
  return idleState;
}

export async function deleteEventAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('event:write').catch(() => null);
  if (!principal) return failure('forbidden');

  const eventId = read(formData, 'eventId');
  if (!z.uuid().safeParse(eventId).success) return failure('invalidInput');

  const db = getDb();
  const [existing] = await db
    .select()
    .from(event)
    .where(and(eq(event.id, eventId), eq(event.familyId, principal.familyId)))
    .limit(1);

  if (!existing) return failure('eventNotFound');

  const scope = read(formData, 'scope');
  const occurrenceStart = read(formData, 'occurrenceStart');

  // Deleting one occurrence of a series is an EXDATE, not a deletion: the
  // series itself survives and every other instance with it.
  if (scope === 'occurrence' && existing.rrule && occurrenceStart) {
    const instant = new Date(occurrenceStart);
    if (Number.isNaN(instant.getTime())) return failure('invalidInput');

    await db
      .update(event)
      .set({
        exdates: addExdate(existing.exdates, exdateLine(instant, existing.tz, existing.allDay)),
        version: sql`${event.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(event.id, eventId), eq(event.familyId, principal.familyId)));

    // Still an *upsert* of the series row, not a deletion: the series gained
    // an EXDATE and every other instance of it survives.
    await publishEvent(principal, 'event.upserted', [eventId]);
  } else {
    // Soft delete: the row stays so the sync engine can echo the tombstone
    // and so a remote resurrection has something to un-delete (§3).
    await db
      .update(event)
      .set({
        deletedAt: new Date(),
        version: sql`${event.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(event.id, eventId), eq(event.familyId, principal.familyId)));

    await publishEvent(principal, 'event.deleted', [eventId]);
  }

  await pushToGoogle(eventId);
  await revalidateCalendar();
  return idleState;
}

const rescheduleSchema = z.object({
  eventId: z.uuid(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
});

export type RescheduleInput = z.infer<typeof rescheduleSchema>;

/**
 * Drag-and-drop reschedule. Takes a plain object rather than `FormData`: the
 * caller is a pointer handler, not a form, and round-tripping through
 * `FormData` would only add a serialisation step to lose type safety in.
 *
 * A dragged *instance* of a series moves that instance alone — same override
 * shape as an occurrence edit, so dragging one week's swimming lesson does not
 * move every week's.
 */
export async function rescheduleEventAction(
  input: RescheduleInput & { occurrenceStart?: string }
): Promise<ActionState> {
  const principal = await assertCan('event:write').catch(() => null);
  if (!principal) return failure('forbidden');

  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return failure('invalidInput');

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  if (endsAt.getTime() < startsAt.getTime()) return failure('endBeforeStart');

  const db = getDb();
  const [existing] = await db
    .select()
    .from(event)
    .where(and(eq(event.id, parsed.data.eventId), eq(event.familyId, principal.familyId)))
    .limit(1);

  if (!existing || existing.deletedAt) return failure('eventNotFound');

  if (existing.rrule && input.occurrenceStart) {
    const instant = new Date(input.occurrenceStart);
    if (Number.isNaN(instant.getTime())) return failure('invalidInput');

    const childId = await db.transaction(async (tx) => {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = existing;

      const [child] = await tx
        .insert(event)
        .values({
          ...rest,
          startsAt,
          endsAt,
          rrule: null,
          rdates: [],
          exdates: [],
          recurrenceParentId: existing.id,
          // The child is a new Google event, not a copy of the parent's
          // identity: clearing these is what stops the push from patching the
          // *series* under the parent's id and etag.
          googleEventId: null,
          etag: null,
          updatedAtRemote: null,
          version: 0,
          pendingSyncAt: null,
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
    await revalidateCalendar();
    return idleState;
  }

  await db
    .update(event)
    .set({
      startsAt,
      endsAt,
      version: sql`${event.version} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(event.id, parsed.data.eventId), eq(event.familyId, principal.familyId)));

  await publishEvent(principal, 'event.upserted', [parsed.data.eventId]);
  await pushToGoogle(parsed.data.eventId);
  await revalidateCalendar();
  return idleState;
}

/* ---------------------------------------------------------------------------
 * Per-calendar display preferences (PRD FR28, milestone M16)
 * ------------------------------------------------------------------------ */

const calendarDisplaySchema = z.object({
  calendarId: z.uuid(),
  visibility: z.enum(CALENDAR_VISIBILITIES),
  /** The type every untyped event on this calendar inherits (M23). */
  defaultType: z.enum(EVENT_TYPES),
  /** Household calendar only: the Google calendar it follows. `''` = none. */
  boundCalendarId: z.uuid().optional().or(z.literal('')),
});

/**
 * How one calendar behaves: whether it is a family calendar or a private one
 * (PRD FR28, M16), and the type its events inherit (M23).
 *
 * It used to carry a colour too. M23 took that away, and the reason is the
 * colouring policy: an event's hue comes from its *type* and from nothing
 * else, so a per-calendar colour was a second answer to a question that may
 * only have one. A calendar's own colour survives as a dot beside its name in
 * this very list — provenance, not category.
 *
 * `display:manage`, so both parents may do it — see that capability's note in
 * `modules/family/authorize.ts`. Nothing here can widen what anyone may read:
 * `calendar:view_private` still decides who sees a private calendar's detail,
 * and marking a calendar private only ever shows *less* (the hub drops it to
 * free/busy on the very next render, via `listEvents`' `privateDetail` flag).
 */
export async function setCalendarDisplayAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('display:manage').catch(() => null);
  if (!principal) return failure('forbidden');

  const parsed = calendarDisplaySchema.safeParse({
    calendarId: read(formData, 'calendarId'),
    visibility: read(formData, 'visibility'),
    defaultType: read(formData, 'defaultType'),
    boundCalendarId: read(formData, 'boundCalendarId'),
  });
  if (!parsed.success) return failure('invalidInput');

  const { calendarId, visibility, defaultType, boundCalendarId } = parsed.data;
  const db = getDb();

  // Scoped by the *principal's* family, never by the form: a forged calendar id
  // from another household matches nothing and the action reports it as gone.
  const [existing] = await db
    .select({ id: calendar.id, isHousehold: calendar.isHousehold })
    .from(calendar)
    .where(and(eq(calendar.id, calendarId), eq(calendar.familyId, principal.familyId)))
    .limit(1);

  if (!existing) return failure('calendarNotFound');

  /**
   * The household calendar's two invariants, enforced here rather than trusted
   * to the form (M23): it is never private — it is the one calendar the whole
   * family is meant to read, and a wall display that redacted it would redact
   * the thing it exists to show — and it is the only calendar that may bind.
   *
   * The binding target is re-read family-scoped for the same reason the
   * calendar itself is: a forged id from another household must resolve to
   * nothing rather than to a pointer across the family boundary.
   */
  const nextVisibility = existing.isHousehold ? 'family' : visibility;
  let nextBoundCalendarId: string | null = null;

  if (existing.isHousehold && boundCalendarId) {
    const [target] = await db
      .select({ id: calendar.id })
      .from(calendar)
      .where(
        and(
          eq(calendar.id, boundCalendarId),
          eq(calendar.familyId, principal.familyId),
          eq(calendar.isHousehold, false),
          eq(calendar.writable, true)
        )
      )
      .limit(1);

    if (!target) return failure('calendarNotFound');
    nextBoundCalendarId = target.id;
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(calendar)
      .set({
        visibility: nextVisibility,
        defaultType,
        ...(existing.isHousehold ? { boundCalendarId: nextBoundCalendarId } : {}),
        updatedAt: now,
      })
      .where(and(eq(calendar.id, calendarId), eq(calendar.familyId, principal.familyId)));

    // The hub has no other way to learn about this: nobody is standing at the
    // wall to navigate, and the board is `force-dynamic` rather than polled.
    await publish(
      {
        familyId: principal.familyId,
        type: 'settings.updated',
        entity: { id: principal.familyId },
        actor: { ...actorOf(principal), source: 'mobile' },
        patch: { calendarId, visibility: nextVisibility, defaultType },
      },
      tx
    );
  });

  await revalidateCalendar();
  revalidatePath(`/${await getLocale()}/settings`);
  return idleState;
}
