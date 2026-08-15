'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { and, eq, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { assertCan, getPrincipal } from '@/modules/family';
import { publish } from '@/modules/realtime';
// The `event` table from the schema assembly point rather than the calendar
// barrel — the same note (and the same import-cycle reason) as `store.ts`.
import { event } from '@/server/db/schema';
import { actionFailure as failure, idleState, type ActionState } from './action-state';
import { getDb } from '@/server/db';
import { stopChannel, watchCalendar } from './channels';
import { enqueueCalendarSync } from './jobs';
import { removeCalendar, unlinkGoogleAccount } from './linking';
import { calendar, googleAccount } from './schema';

/**
 * Mutations for the Google slice. Every action authorizes through
 * `assertCan('google:link', …)` before it touches data (§7 chokepoint,
 * enforced by `tests/unit/server-action-authorization.test.ts`).
 *
 * `google:link` grades `own` for an adult and `allow` for the owner, and the
 * grade is resolved *before* any read — so each action authorizes against the
 * caller's own member id first, then narrows the query itself for a non-owner.
 * That ordering is what keeps the AST auditor satisfied and, more importantly,
 * what stops an adult from acting on another parent's linked account.
 */

const uuid = z.uuid();

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/** Restricts a query to the caller's own accounts unless they are the owner. */
function ownershipFilter(principal: { role: string; memberId: string }) {
  return principal.role === 'owner'
    ? undefined
    : eq(googleAccount.ownerMemberId, principal.memberId);
}

export async function setCalendarSyncAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') return failure('forbidden');

  const authorized = await assertCan('google:link', {
    ownerMemberId: principal.memberId,
  }).catch(() => null);
  if (!authorized) return failure('forbidden');

  const calendarId = read(formData, 'calendarId');
  const enabled = read(formData, 'enabled') === 'true';
  if (!uuid.safeParse(calendarId).success) return failure('invalidInput');

  const db = getDb();
  const [row] = await db
    .select()
    .from(calendar)
    .innerJoin(googleAccount, eq(calendar.googleAccountId, googleAccount.id))
    .where(
      and(
        eq(calendar.id, calendarId),
        eq(calendar.familyId, principal.familyId),
        ownershipFilter(principal)
      )
    )
    .limit(1)
    .then((rows) => rows.map((entry) => entry.calendar));

  if (!row) return failure('calendarNotFound');

  await applyCalendarSync(calendarId, enabled);

  await publish({
    familyId: principal.familyId,
    type: 'settings.updated',
    entity: { id: principal.familyId },
    actor: { memberId: principal.memberId, source: 'mobile' },
    patch: { calendarId, syncEnabled: enabled },
  });

  const locale = await getLocale();
  revalidatePath(`/${locale}/settings/google`);
  revalidatePath(`/${locale}/calendar`);
  revalidatePath(`/${locale}/today`);
  revalidatePath(`/${locale}/hub`);
  return idleState;
}

/**
 * One calendar's sync switch, flipped — the database half plus the two Google
 * calls that follow from it. Shared by `setCalendarSyncAction` (one calendar,
 * one tap) and `applyCalendarSelectionAction` (a whole account, confirmed in
 * the picker), so the two can never drift into treating "off" differently.
 *
 * Authorization lives in the callers: this function takes an id that has
 * already been proven to belong to the caller's family (and, for a non-owner,
 * to their own linked account).
 *
 * `syncEnabled` used to govern only the ingest side — the poll skipped the
 * calendar and its channel stopped — while every event it had already imported
 * stayed on the board forever. A parent who muted a colleague's shared diary in
 * settings watched it keep rendering on the wall and reasonably concluded the
 * switch did nothing. It reads as an on/off for the calendar, so it has to be
 * one.
 *
 * The delete and the cursor clear are one transaction, and the ordering
 * matters: a process that died between them would leave a calendar with no
 * events but a live `syncToken`, so the next incremental pass would ask Google
 * only for what had *changed* and would restore nothing. Clearing the token in
 * the same commit makes the next enable a full initial sync by construction
 * (`sync-engine.ts`: `mode = calendar.syncToken ? … : 'initial'`).
 *
 * Nothing is published per deleted row. Emitting N `event.deleted` events for a
 * fifteen-hundred-event work calendar would flood every open stream in the
 * household to say one thing; `settings.updated` says that one thing once, and
 * every hub already treats it as "re-read yourself" (M16) — which is why the
 * publish stays with the callers, one per parent action rather than one per
 * calendar.
 */
async function applyCalendarSync(calendarId: string, enabled: boolean): Promise<void> {
  const db = getDb();

  const [updated] = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(calendar)
      .set({
        syncEnabled: enabled,
        // Cleared on *both* edges, not just the disable.
        //
        // Disabling clears it so the return trip is a full pass. Enabling has to
        // clear it too, because a sync pass already in flight when the disable
        // committed can write a fresh cursor *after* the delete: the calendar is
        // then empty with a live token, and the re-enable would sync
        // incrementally and permanently miss every event it just deleted. There
        // is no cursor worth keeping here — the calendar has no events.
        syncToken: null,
        syncedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(calendar.id, calendarId))
      .returning();

    if (!enabled) {
      // A hard delete, not a tombstone: a tombstone exists so *sync* can echo
      // a deletion back to Google, and nothing here should ever reach Google —
      // the events are being forgotten locally, not cancelled in somebody's
      // calendar.
      //
      // Google-sourced rows only. A row on this calendar with no
      // `google_event_id` is one a parent created in Kynite that has not been
      // pushed yet (queued, or stuck behind a failing push): Google has never
      // seen it, so re-enabling could not bring it back. Deleting it would
      // destroy the only copy.
      await tx
        .delete(event)
        .where(and(eq(event.calendarId, calendarId), isNotNull(event.googleEventId)));
    }

    return [row] as const;
  });

  if (enabled) {
    // Watch first, then sync: a channel registered after the initial pass would
    // miss every change made during it.
    await watchCalendar(updated).catch(() => {});
    await enqueueCalendarSync(calendarId);
  } else {
    await stopChannel(updated).catch(() => {});
  }
}

/**
 * The picker's one submit: *this* is the set of calendars that syncs.
 *
 * Linking a Google account no longer guesses. Discovery switches on the
 * account's own calendar and nothing else (`initialSyncEnabled`), the settings
 * page opens the picker on `?linked=`, and this action applies whatever the
 * parent ticked — additions and removals in one confirmation, rather than a row
 * of toggles each costing a round trip and a full-page revalidation.
 *
 * Only rows whose state actually *changes* are touched. Re-applying "on" to an
 * already-syncing calendar would clear its cursor and re-run a full initial
 * sync for no reason; re-applying "off" would be a delete of nothing. A parent
 * who ticks one extra calendar and confirms should cost exactly one calendar's
 * worth of work.
 *
 * Same `google:link` chokepoint and `ownershipFilter` narrowing as its
 * neighbours, and the account id is not trusted: the calendars are read through
 * a join on `google_account` scoped to the caller's family, so an id belonging
 * to another household simply selects nothing.
 */
export async function applyCalendarSelectionAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') return failure('forbidden');

  const authorized = await assertCan('google:link', {
    ownerMemberId: principal.memberId,
  }).catch(() => null);
  if (!authorized) return failure('forbidden');

  const accountId = read(formData, 'accountId');
  if (!uuid.safeParse(accountId).success) return failure('invalidInput');

  // One comma-separated hidden field rather than N checkbox inputs: an
  // *unticked* checkbox submits nothing at all, so a form of checkboxes cannot
  // distinguish "switch this one off" from "this one was not on the screen" —
  // and that distinction is the entire point of the picker.
  const selected = new Set(
    read(formData, 'calendarIds')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => uuid.safeParse(value).success)
  );

  const rows = await getDb()
    .select()
    .from(calendar)
    .innerJoin(googleAccount, eq(calendar.googleAccountId, googleAccount.id))
    .where(
      and(
        eq(calendar.googleAccountId, accountId),
        eq(calendar.familyId, principal.familyId),
        ownershipFilter(principal)
      )
    )
    .then((entries) => entries.map((entry) => entry.calendar));

  if (rows.length === 0) return failure('accountNotFound');

  const changed = rows.filter((row) => row.syncEnabled !== selected.has(row.id));
  for (const row of changed) await applyCalendarSync(row.id, selected.has(row.id));

  if (changed.length > 0) {
    await publish({
      familyId: principal.familyId,
      type: 'settings.updated',
      entity: { id: principal.familyId },
      actor: { memberId: principal.memberId, source: 'mobile' },
      patch: { accountId, calendarIds: changed.map((row) => row.id) },
    });
  }

  const locale = await getLocale();
  revalidatePath(`/${locale}/settings/google`);
  revalidatePath(`/${locale}/calendar`);
  revalidatePath(`/${locale}/today`);
  revalidatePath(`/${locale}/hub`);
  return idleState;
}

export async function syncNowAction(
  _previous: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') return failure('forbidden');

  const authorized = await assertCan('google:link', {
    ownerMemberId: principal.memberId,
  }).catch(() => null);
  if (!authorized) return failure('forbidden');

  const rows = await getDb()
    .select({ id: calendar.id })
    .from(calendar)
    .where(and(eq(calendar.familyId, principal.familyId), eq(calendar.syncEnabled, true)));

  for (const row of rows) await enqueueCalendarSync(row.id);

  revalidatePath(`/${await getLocale()}/settings/google`);
  return idleState;
}

export async function unlinkGoogleAccountAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') return failure('forbidden');

  const authorized = await assertCan('google:link', {
    ownerMemberId: principal.memberId,
  }).catch(() => null);
  if (!authorized) return failure('forbidden');

  const accountId = read(formData, 'accountId');
  if (!uuid.safeParse(accountId).success) return failure('invalidInput');

  const [account] = await getDb()
    .select({ id: googleAccount.id })
    .from(googleAccount)
    .where(
      and(
        eq(googleAccount.id, accountId),
        eq(googleAccount.familyId, principal.familyId),
        ownershipFilter(principal)
      )
    )
    .limit(1);

  if (!account) return failure('accountNotFound');

  await unlinkGoogleAccount(account.id);

  revalidatePath(`/${await getLocale()}/settings/google`);
  return idleState;
}

/**
 * Take one calendar out of Kynite (M18).
 *
 * The missing half of the destructive surface: before this, a parent whose
 * partner's work calendar was flooding the wall board could only turn *sync*
 * off, which leaves every event already imported sitting on the board forever,
 * or unlink the whole Google account and lose the calendars they wanted too.
 *
 * "Remove", not "delete": the row and its events go from *our* database, the
 * push channel is stopped, and nothing whatsoever happens at Google. The
 * confirmation in `google-accounts-panel.tsx` says so, and it says how many
 * events go with it — that count comes from `countEventsByCalendar`, read on
 * the server before the dialog is ever opened, so the number a parent agrees
 * to is a real one rather than an estimate.
 *
 * Same `google:link` chokepoint and same `ownershipFilter` narrowing as its
 * neighbours: an adult may only remove a calendar hanging off their own linked
 * account, and the owner may remove any.
 */
export async function removeCalendarAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') return failure('forbidden');

  const authorized = await assertCan('google:link', {
    ownerMemberId: principal.memberId,
  }).catch(() => null);
  if (!authorized) return failure('forbidden');

  const calendarId = read(formData, 'calendarId');
  if (!uuid.safeParse(calendarId).success) return failure('invalidInput');

  const [row] = await getDb()
    .select()
    .from(calendar)
    .innerJoin(googleAccount, eq(calendar.googleAccountId, googleAccount.id))
    .where(
      and(
        eq(calendar.id, calendarId),
        eq(calendar.familyId, principal.familyId),
        ownershipFilter(principal)
      )
    )
    .limit(1)
    .then((rows) => rows.map((entry) => entry.calendar));

  if (!row) return failure('calendarNotFound');

  await removeCalendar(row);

  revalidatePath(`/${await getLocale()}/settings/google`);
  revalidatePath(`/${await getLocale()}/calendar`);
  return idleState;
}
