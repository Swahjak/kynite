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
import { syncCalendar, type SyncResult } from './domain/sync-engine';
import { pushEvent, type PushResult, type PushableEvent } from './domain/push-engine';
import type { CalendarSyncState, GoogleCalendarApi, GoogleCalendarResource } from './domain/types';
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

function syncState(row: Calendar): CalendarSyncState {
  return {
    id: row.id,
    familyId: row.familyId,
    googleCalendarId: row.googleCalendarId,
    syncToken: row.syncToken,
    timeZone: row.timeZone,
  };
}

async function loadCalendar(calendarId: string): Promise<Calendar | null> {
  const [row] = await getDb().select().from(calendar).where(eq(calendar.id, calendarId)).limit(1);
  return row ?? null;
}

/** One calendar, one incremental (or full) pass. The `google:sync-calendar` job body. */
export async function syncCalendarById(calendarId: string): Promise<SyncResult | null> {
  const row = await loadCalendar(calendarId);
  if (!row || !row.syncEnabled) return null;

  return syncCalendar({
    calendar: syncState(row),
    api: apiForAccount(row.googleAccountId),
    store: syncStore,
    emit: publishEmitter,
    echo: echoRegistry,
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
 * Calendar discovery (§5): the account's calendar list, upserted.
 *
 * New calendars arrive with `syncEnabled` at its column default, which is
 * `true` (docs/architecture.md §3) — linking an account syncs every calendar
 * it can see from the start; the settings surface is where a parent turns
 * one off, not where they turn one on. `summary`/`color`/`writable` are
 * refreshed on every pass; `syncEnabled` and `visibility` are never
 * overwritten once set, because from that point on they are the parent's
 * choices, not Google's.
 */
export async function discoverCalendars(googleAccountId: string): Promise<Calendar[]> {
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

  for (const resource of resources) {
    if (resource.deleted) continue;

    const values = {
      familyId: account.familyId,
      googleAccountId,
      googleCalendarId: resource.id,
      summary: resource.summaryOverride ?? resource.summary ?? resource.id,
      color: resource.backgroundColor ?? null,
      timeZone: resource.timeZone ?? null,
      writable: resource.accessRole === 'owner' || resource.accessRole === 'writer',
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
