import 'server-only';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/server/db';
import { event } from '@/modules/calendar';
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
          writable: values.writable,
          updatedAt: new Date(),
        },
      })
      .returning();

    saved.push(row);
  }

  return saved;
}

/** The `google:push-event` job body: one local event, pushed to its calendar. */
export async function pushEventById(eventId: string): Promise<PushResult | null> {
  const [row] = await getDb().select().from(event).where(eq(event.id, eventId)).limit(1);
  if (!row?.calendarId) return null;

  const calendarRow = await loadCalendar(row.calendarId);
  if (!calendarRow || !calendarRow.writable || !calendarRow.syncEnabled) return null;

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

  return pushEvent({
    event: pushable,
    calendar: syncState(calendarRow),
    api: apiForAccount(calendarRow.googleAccountId),
    store: pushStore,
    emit: publishEmitter,
    echo: echoRegistry,
  });
}
