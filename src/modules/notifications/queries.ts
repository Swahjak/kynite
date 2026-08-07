import 'server-only';
import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { getDb } from '@/server/db';
// Table objects come from the schema assembly point, not from a slice barrel
// (the same note `modules/timers/queries.ts` carries): `queries.ts` is not a
// `schema.ts`, so the cross-slice deep-import exemption does not apply to it.
import { family, member, routine } from '@/server/db/schema';
import { nextSubscriptionState, type DeliveryOutcome } from './domain/delivery';
import type { ScannableRoutine } from './domain/reminder-window';
import { pushSubscription, reminderDispatch, type PushSubscription } from './schema';

/**
 * Reads and writes for web push and reminder dispatch (docs/architecture.md
 * §6, §8).
 *
 * Every family-facing query takes its `familyId` from the caller's principal;
 * the two that do not (`listScannableFamilies`, the trims) are job bodies with
 * no principal at all, and they are the only functions here that see more than
 * one family.
 */

export type SubscriptionUpsert = {
  familyId: string;
  memberId: string;
  /**
   * Always `null` in practice, and that is the settled answer rather than an
   * omission (M11 carry-forward, closed in M12).
   *
   * §6 is explicit that web push is "parents only", and the §7 capability
   * matrix gives a device principal no notification row at all — a wall tablet
   * is a screen the whole house can read, so a push notification on it is a
   * message delivered to whoever walks past. The column stays because
   * `docs/architecture.md` §3 declares it and because the day a *parent's*
   * phone is also a paired `kind:'mobile'` device, "which of my devices is
   * this endpoint" becomes answerable without a migration. Until a milestone
   * sanctions push on a paired device, nothing sets it.
   */
  deviceId?: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
};

/**
 * Thrown when a subscribe names an endpoint another household already owns.
 *
 * The caller turns this into the same generic failure a malformed body gets:
 * confirming "that endpoint belongs to someone else" would answer a question
 * the asker has no business asking.
 */
export class PushEndpointConflictError extends Error {
  constructor() {
    super('pushEndpointOwnedByAnotherFamily');
    this.name = 'PushEndpointConflictError';
  }
}

/**
 * Upsert by `endpoint` (§6 step 2: "`push_subscription` keyed by endpoint").
 *
 * The endpoint *is* the device: a browser that re-subscribes after a token
 * rotation produces a new endpoint (a new row), and one that re-subscribes
 * with the same endpoint is the same device saying hello again. So a repeat
 * subscribe re-points the row at whoever is signed in now, refreshes the keys,
 * and — the part that matters — clears `failureCount`/`disabledAt`: a device
 * that just asked for notifications is by definition reachable.
 *
 * **Re-pointing stops at the household boundary.** "Whoever is signed in now"
 * means whoever is signed in *in this family*: the `setWhere` below refuses
 * the update when the stored row belongs to another family, so a member of one
 * household cannot post a second household's endpoint and take ownership of
 * that device's reminders. The endpoint string is a capability URL — anyone
 * holding it can already be sent notifications — but holding it must not also
 * hand over the row, its member, and its keys.
 *
 * Refusal is atomic rather than a read-then-write: `ON CONFLICT … DO UPDATE …
 * WHERE family_id = $me` leaves a foreign row untouched and returns nothing,
 * which is the branch below. A separate `SELECT` first would leave a window in
 * which the two interleave.
 */
export async function upsertPushSubscription(input: SubscriptionUpsert): Promise<PushSubscription> {
  const [row] = await getDb()
    .insert(pushSubscription)
    .values({
      familyId: input.familyId,
      memberId: input.memberId,
      deviceId: input.deviceId ?? null,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: pushSubscription.endpoint,
      set: {
        memberId: input.memberId,
        deviceId: input.deviceId ?? null,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
        failureCount: 0,
        disabledAt: null,
        updatedAt: new Date(),
      },
      // The existing row's family, not the proposed one: an endpoint stays
      // with the household that registered it. `familyId` is deliberately
      // absent from `set` for the same reason — there is no path here that
      // moves a row between families.
      setWhere: eq(pushSubscription.familyId, input.familyId),
    })
    .returning();

  if (!row) throw new PushEndpointConflictError();

  return row;
}

/** Unsubscribe from this browser, or prune an endpoint the service says is gone. */
export async function deletePushSubscriptionByEndpoint(
  endpoint: string,
  familyId?: string
): Promise<number> {
  const rows = await getDb()
    .delete(pushSubscription)
    .where(
      familyId
        ? and(eq(pushSubscription.endpoint, endpoint), eq(pushSubscription.familyId, familyId))
        : eq(pushSubscription.endpoint, endpoint)
    )
    .returning({ id: pushSubscription.id });

  return rows.length;
}

export async function getPushSubscription(id: string): Promise<PushSubscription | null> {
  const [row] = await getDb()
    .select()
    .from(pushSubscription)
    .where(eq(pushSubscription.id, id))
    .limit(1);

  return row ?? null;
}

/**
 * Apply what one delivery attempt means for the row (`domain/delivery.ts`).
 *
 * Returns the action taken so the caller can log it; the policy itself is the
 * pure function's, which is what the unit tests pin.
 */
export async function applyDeliveryOutcome(
  id: string,
  outcome: DeliveryOutcome
): Promise<'keep' | 'delete' | 'disable' | 'missing'> {
  const db = getDb();
  const current = await getPushSubscription(id);
  if (!current) return 'missing';

  const next = nextSubscriptionState(current, outcome);

  if (next.action === 'delete') {
    await db.delete(pushSubscription).where(eq(pushSubscription.id, id));
    return 'delete';
  }

  await db
    .update(pushSubscription)
    .set({
      failureCount: next.failureCount,
      disabledAt: next.action === 'disable' ? (current.disabledAt ?? new Date()) : null,
      lastSuccessAt: outcome === 'success' ? new Date() : current.lastSuccessAt,
      updatedAt: new Date(),
    })
    .where(eq(pushSubscription.id, id));

  return next.action;
}

/** Live endpoints for one member — the reminder fan-out target. */
export async function listActiveSubscriptions(
  familyId: string,
  memberIds: readonly string[]
): Promise<PushSubscription[]> {
  if (memberIds.length === 0) return [];

  return getDb()
    .select()
    .from(pushSubscription)
    .where(
      and(
        eq(pushSubscription.familyId, familyId),
        inArray(pushSubscription.memberId, [...memberIds]),
        isNull(pushSubscription.disabledAt)
      )
    );
}

/**
 * Every adult in the family (§6: "Redemption requests fan out to all adults").
 * `caregiver` is not an adult for this purpose — a babysitter does not approve
 * a reward.
 */
export async function listAdultMemberIds(familyId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.familyId, familyId), inArray(member.role, ['owner', 'adult'])));

  return rows.map((row) => row.id);
}

/**
 * Claim the idempotency key (§8). `true` means this call is the one that gets
 * to notify; `false` means someone already did — a second scan pass, a retry,
 * or the process that died halfway through the last one.
 *
 * The claim is written *before* the push is sent, not after. A restart between
 * claim and send therefore loses a notification rather than sending two, which
 * is the right way round for a household: a missed reminder is invisible, a
 * duplicated one is the nagging this product exists to remove.
 */
export async function claimReminderDispatch(input: {
  familyId: string;
  routineId: string;
  occurrenceDate: string;
  memberId: string;
}): Promise<boolean> {
  const rows = await getDb()
    .insert(reminderDispatch)
    .values(input)
    .onConflictDoNothing()
    .returning({ id: reminderDispatch.id });

  return rows.length > 0;
}

export type ScannableFamily = {
  familyId: string;
  timeZone: string;
  locale: string;
  routines: ScannableRoutine[];
};

/**
 * Every family's active, timed routines, grouped for the scan.
 *
 * One query for the whole install: the scan runs every minute and a query per
 * family would turn a household count into a queries-per-minute count. A
 * routine with no `timeOfDay` still has one (the schedule default), so the
 * filter is on `active` alone.
 */
export async function listScannableFamilies(): Promise<ScannableFamily[]> {
  const rows = await getDb()
    .select({
      familyId: family.id,
      timeZone: family.timezone,
      locale: family.locale,
      routineId: routine.id,
      ownerMemberId: routine.ownerMemberId,
      schedule: routine.schedule,
      createdAt: routine.createdAt,
    })
    .from(routine)
    .innerJoin(family, eq(family.id, routine.familyId))
    .where(eq(routine.active, true));

  const families = new Map<string, ScannableFamily>();

  for (const row of rows) {
    let entry = families.get(row.familyId);
    if (!entry) {
      entry = {
        familyId: row.familyId,
        timeZone: row.timeZone,
        locale: row.locale,
        routines: [],
      };
      families.set(row.familyId, entry);
    }

    entry.routines.push({
      id: row.routineId,
      familyId: row.familyId,
      ownerMemberId: row.ownerMemberId,
      schedule: row.schedule,
      anchor: row.createdAt,
    });
  }

  return [...families.values()];
}

/** Title and owner of one routine, for the reminder body. */
export async function getReminderRoutine(
  familyId: string,
  routineId: string
): Promise<{ title: string; ownerMemberId: string } | null> {
  const [row] = await getDb()
    .select({ title: routine.title, ownerMemberId: routine.ownerMemberId })
    .from(routine)
    .where(and(eq(routine.id, routineId), eq(routine.familyId, familyId)))
    .limit(1);

  return row ?? null;
}

/** The family's locale, so a job can localize without a request context. */
export async function getFamilyLocale(familyId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ locale: family.locale })
    .from(family)
    .where(eq(family.id, familyId))
    .limit(1);

  return row?.locale ?? null;
}

/** Rows older than `before`, deleted. Used by `maintenance:trim` (§8). */
export async function trimReminderDispatch(before: Date): Promise<number> {
  // `rowCount`, not `.returning({ id })`: the answer is a count, and the ids of
  // every pruned ledger row are work done only to be discarded.
  const result = await getDb()
    .delete(reminderDispatch)
    .where(lt(reminderDispatch.createdAt, before));

  return result.rowCount ?? 0;
}

/** Count of live subscriptions for a member — what the settings panel shows. */
export async function countActiveSubscriptions(
  familyId: string,
  memberId: string
): Promise<number> {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(pushSubscription)
    .where(
      and(
        eq(pushSubscription.familyId, familyId),
        eq(pushSubscription.memberId, memberId),
        isNull(pushSubscription.disabledAt)
      )
    );

  return row?.count ?? 0;
}
