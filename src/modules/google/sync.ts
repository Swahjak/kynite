import 'server-only';
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { getDb } from '@/server/db';
// The `event` *table*, from the schema assembly point rather than from
// `@/modules/calendar`. Two reasons, and the second is the load-bearing one:
//
//  1. It is the table object a query needs, which is exactly what
//     `server/db/schema.ts` exists to collect (§2 names it the schema assembly
//     point, and the boundary lint already exempts it).
//  2. `@/modules/calendar` re-exports that slice's client components, which
//     pull `next-intl`'s client navigation. Importing the barrel here made the
//     Google slice — and every Node test that touches it — drag a React client
//     graph into a plain server module, and created a genuine import cycle
//     (calendar barrel → actions → google barrel → store → calendar barrel).
import { event } from '@/server/db/schema';
import { createGoogleCalendarApi } from './api';
import { loadMemberDirectory } from './directory';
import {
  initialSyncEnabled,
  isOwnedCalendar,
  type NewCalendarDefault,
} from './domain/calendar-list';
import { syncCalendar, type SyncResult } from './domain/sync-engine';
import { pushEvent, type PushResult, type PushableEvent } from './domain/push-engine';
import type { CalendarSyncState, GoogleCalendarApi, GoogleCalendarResource } from './domain/types';
// Discovery's prune (below) removes a calendar the same way settings does, so
// it calls the same function rather than a second copy of it. That makes
// `sync ↔ linking` a cycle on paper — `linking` imports `discoverCalendars`
// from here — but only a function-level one: neither module reads the other at
// evaluation time, and both bindings are hoisted declarations.
import { removeCalendar } from './linking';
import { calendar, googleAccount, type Calendar } from './schema';
import { echoRegistry, publishEmitter, pushStore, syncStore } from './store';
import { accessTokenProvider } from './tokens';

/**
 * Server wiring for the sync engines (docs/architecture.md §5).
 *
 * The engines themselves are pure; this file is the only place that knows a
 * calendar row has an account, an account has a token, and a token buys an
 * HTTP client.
 */

export function apiForAccount(googleAccountId: string): GoogleCalendarApi {
  return createGoogleCalendarApi({ getAccessToken: accessTokenProvider(googleAccountId) });
}

/**
 * A calendar row that Google is actually behind (M23).
 *
 * The `calendar` table now also holds the household's own "Gezin" calendar,
 * which has no account and no remote id — so every entry point into the sync
 * and push engines narrows to this shape first. A household calendar reaching
 * `apiForAccount(null)` would be a token lookup for an account that does not
 * exist; skipping it is the correct answer, not an error.
 */
export type GoogleBackedCalendar = Calendar & {
  googleAccountId: string;
  googleCalendarId: string;
};

export function isGoogleBacked(row: Calendar): row is GoogleBackedCalendar {
  return row.googleAccountId !== null && row.googleCalendarId !== null;
}

function syncState(row: GoogleBackedCalendar): CalendarSyncState {
  return {
    id: row.id,
    familyId: row.familyId,
    googleCalendarId: row.googleCalendarId,
    syncToken: row.syncToken,
    timeZone: row.timeZone,
    ownerMemberId: row.ownerMemberId,
  };
}

async function loadCalendar(calendarId: string): Promise<Calendar | null> {
  const [row] = await getDb().select().from(calendar).where(eq(calendar.id, calendarId)).limit(1);
  return row ?? null;
}

/** One calendar, one incremental (or full) pass. The `google:sync-calendar` job body. */
export async function syncCalendarById(calendarId: string): Promise<SyncResult | null> {
  const row = await loadCalendar(calendarId);
  if (!row || !row.syncEnabled || !isGoogleBacked(row)) return null;

  // M23: "whose calendar is this" is now a column on the row itself
  // (`calendar.owner_member_id`, written by discovery), so the only thing left
  // to resolve here is the other half of attribution — which addresses this
  // household owns.
  const directory = await loadMemberDirectory(row.familyId);

  return syncCalendar({
    calendar: syncState(row),
    api: apiForAccount(row.googleAccountId),
    store: syncStore,
    emit: publishEmitter,
    echo: echoRegistry,
    directory,
  });
}

/**
 * §5 "Renewal + fallback": every enabled calendar, incrementally. Catches the
 * notifications a dead channel or a missed webhook lost.
 */
export async function listSyncableCalendars(): Promise<Calendar[]> {
  return getDb()
    .select()
    .from(calendar)
    .innerJoin(googleAccount, eq(calendar.googleAccountId, googleAccount.id))
    .where(and(eq(calendar.syncEnabled, true), eq(googleAccount.status, 'active')))
    .then((rows) => rows.map((row) => row.calendar));
}

/**
 * Calendar discovery (§5): the calendars the account holder *owns*, upserted.
 *
 * **Owner-only is a product boundary, not a default.** Kynite is a family
 * planner: the calendars that belong on a household's wall are the ones the
 * people in that household keep. Google's calendar list is much wider than
 * that — a work account reports every colleague's shared diary, every meeting
 * room, every subscribed feed — and none of those are the family's to hold. So
 * a resource whose `accessRole` is not `owner` is not merely switched off here;
 * it is never stored, which is what makes it impossible to pick, to enable and
 * to sync. `accessRole: 'owner'` is exactly the set of calendars the account
 * holder created themselves (their primary included, which Google always grades
 * `owner`), and exactly not the ones they subscribed to (`reader`) or were
 * granted access on (`reader`/`writer`).
 *
 * Two consequences worth naming rather than discovering later: every row this
 * function writes now has `writable: true` and an `ownerMemberId` equal to the
 * account's owner. Both columns stay — `writable` still describes rows written
 * before this rule and is what the UI's read-only marker reads, and
 * `ownerMemberId` is nulled by a member deletion (`onDelete: 'set null'`), so
 * neither is safely re-derivable from "the row exists".
 *
 * **Pruning.** The same pass removes any google-backed row of this account that
 * the list no longer grades `owner` — access revoked, a subscription that
 * predates this rule, or a calendar Google no longer returns at all (deleted,
 * or unsubscribed at Google). Removal goes through `removeCalendar`, so it is
 * the same operation as a parent's "remove" in settings: the push channel is
 * stopped and the row goes with its events. Nothing is pruned when the list
 * itself fails — the pagination loop below throws before this point, so a bad
 * network trip can never be read as "the household owns nothing".
 *
 * **What a new calendar arrives switched on.** Until M18 every discovered
 * calendar took the column default, `true`, so linking a work account put
 * fifteen calendars onto the family's wall board in one tap, and the parent's
 * first experience of the feature was turning most of it off. A new row now
 * takes `newCalendarDefault` (see `initialSyncEnabled`): the primary calendar on
 * a first link, nothing at all on a relink, and the picker that opens after
 * linking is where the household says which of its *own* calendars it wants.
 *
 * `summary`/`color`/`writable`/`timeZone` are refreshed on every pass;
 * `syncEnabled` and `visibility` are never overwritten once the row exists,
 * because from that point on they are the parent's choices, not Google's —
 * which is why the flag below is in `values` and deliberately *not* in the
 * conflict `set`.
 */
export async function discoverCalendars(
  googleAccountId: string,
  opts: { newCalendarDefault?: NewCalendarDefault } = {}
): Promise<Calendar[]> {
  const newCalendarDefault = opts.newCalendarDefault ?? 'primary-only';

  const [account] = await getDb()
    .select()
    .from(googleAccount)
    .where(eq(googleAccount.id, googleAccountId))
    .limit(1);

  if (!account) return [];

  const api = apiForAccount(googleAccountId);
  const resources: GoogleCalendarResource[] = [];
  let pageToken: string | null = null;

  do {
    const page = await api.listCalendars(pageToken);
    resources.push(...(page.items ?? []));
    pageToken = page.nextPageToken ?? null;
  } while (pageToken);

  const db = getDb();
  const saved: Calendar[] = [];

  // The household's own calendars, and nothing else — see the note above.
  const owned = resources.filter(isOwnedCalendar);
  const ownedIds = new Set(owned.map((resource) => resource.id));

  // Prune first: a row this account holds that Google no longer grades `owner`
  // — including one absent from the list entirely — is removed exactly the way
  // settings removes one. The household's own native calendar cannot be
  // selected here (it has no `google_account_id`) and `removeCalendar` refuses
  // it anyway.
  const stored = await db
    .select()
    .from(calendar)
    .where(eq(calendar.googleAccountId, googleAccountId));

  for (const row of stored) {
    if (row.googleCalendarId !== null && ownedIds.has(row.googleCalendarId)) continue;
    await removeCalendar(row);
  }

  for (const resource of owned) {
    const values = {
      familyId: account.familyId,
      googleAccountId,
      googleCalendarId: resource.id,
      summary: resource.summaryOverride ?? resource.summary ?? resource.id,
      color: resource.backgroundColor ?? null,
      timeZone: resource.timeZone ?? null,
      // Constant `true` for anything reaching this loop, since an owner may
      // always write their own calendar. Still derived rather than hard-coded:
      // the column is what the read-only marker in the settings list and the
      // picker read, and it is the one place the answer would have to change if
      // the filter above ever widened again.
      writable: resource.accessRole === 'owner' || resource.accessRole === 'writer',
      // Google's own answer to "is this the account holder's calendar" — the
      // input to attribution's owner fallback (M18, `attributeEvent`). Refreshed
      // on every pass like the other Google-owned facts, because it is one.
      isPrimary: resource.primary === true,
      /**
       * "Is this the account holder's own calendar" (M23) — which, since the
       * owner-only filter above, is every row this loop writes. It is still
       * written explicitly rather than assumed: a member deletion nulls this
       * column (`onDelete: 'set null'`), so "the row exists" does not imply it
       * is set, and a rediscovery pass is how it comes back.
       */
      ownerMemberId:
        resource.primary === true || resource.accessRole === 'owner' ? account.ownerMemberId : null,
      syncEnabled: initialSyncEnabled(resource, newCalendarDefault),
    };

    const [row] = await db
      .insert(calendar)
      .values(values)
      .onConflictDoUpdate({
        target: [calendar.googleAccountId, calendar.googleCalendarId],
        set: {
          summary: values.summary,
          color: values.color,
          timeZone: values.timeZone,
          writable: values.writable,
          isPrimary: values.isPrimary,
          ownerMemberId: values.ownerMemberId,
          updatedAt: new Date(),
        },
      })
      .returning();

    saved.push(row);
  }

  return saved;
}

/**
 * `pushEventById`'s result, made explicit rather than `PushResult | null`
 * (N6): a caller that reads "no result" as success would silently never clear
 * `pendingSyncAt` for the very rows that can never be pushed (a native event, a
 * read-only calendar, one with sync turned off) — see `pushEventWithRetry` in
 * `./push`, the one place that interprets this.
 */
export type PushEventOutcome =
  | ({ status: 'pushed' } & PushResult)
  | { status: 'skipped'; reason: 'event-not-found' | 'native' | 'not-writable' | 'sync-disabled' };

/** The `google:push-event` job body: one local event, pushed to its calendar. */
export async function pushEventById(eventId: string): Promise<PushEventOutcome> {
  const [row] = await getDb().select().from(event).where(eq(event.id, eventId)).limit(1);
  if (!row) return { status: 'skipped', reason: 'event-not-found' };
  if (!row.calendarId) return { status: 'skipped', reason: 'native' };

  const calendarRow = await loadCalendar(row.calendarId);
  if (!calendarRow) return { status: 'skipped', reason: 'event-not-found' };
  // The household's own calendar is native: there is nothing to push to until
  // somebody binds it, and a bound event lives on the Google row instead.
  if (!isGoogleBacked(calendarRow)) return { status: 'skipped', reason: 'native' };
  if (!calendarRow.writable) return { status: 'skipped', reason: 'not-writable' };
  if (!calendarRow.syncEnabled) return { status: 'skipped', reason: 'sync-disabled' };

  const pushable: PushableEvent = {
    id: row.id,
    googleEventId: row.googleEventId,
    etag: row.etag,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    title: row.title,
    description: row.description,
    location: row.location,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    allDay: row.allDay,
    tz: row.tz,
    rrule: row.rrule,
    rdates: row.rdates,
    exdates: row.exdates,
  };

  const result = await pushEvent({
    event: pushable,
    calendar: syncState(calendarRow),
    api: apiForAccount(calendarRow.googleAccountId),
    store: pushStore,
    emit: publishEmitter,
    echo: echoRegistry,
  });

  return { status: 'pushed', ...result };
}

/** Batch cap for one `google:poll` pass's repair sweep — see below. */
const PENDING_SYNC_BATCH = 50;

/**
 * N5: the events still carrying `pendingSyncAt`, oldest first.
 *
 * `sync-bridge.ts`'s `pushToGoogle` claimed "the next poll repairs it", which
 * was false — poll only pulls. This is the read half of making that claim
 * true: `registerGoogleJobs`'s `google:poll` handler re-enqueues a
 * `google:push-event` for each id this returns, capped so one long-stuck
 * backlog (a dead Google account, say) cannot flood the queue on every poll.
 */
export async function listPendingSyncEventIds(limit = PENDING_SYNC_BATCH): Promise<string[]> {
  const rows = await getDb()
    .select({ id: event.id })
    .from(event)
    .where(isNotNull(event.pendingSyncAt))
    .orderBy(asc(event.pendingSyncAt))
    .limit(limit);

  return rows.map((row) => row.id);
}
