import { GoogleApiError } from './errors';
import { fromGoogleEvent, isTombstone } from './mapping';
import type {
  CalendarSyncState,
  Emitter,
  GoogleCalendarApi,
  GoogleEventResource,
  MappedEvent,
  SyncStore,
} from './types';
import type { EchoRegistry } from './echo';

/**
 * Incremental calendar sync (docs/architecture.md §5 "Incremental sync").
 *
 *   1. **Initial** — no `syncToken`: full paginated list with
 *      `singleEvents=false`, store `nextSyncToken`.
 *   2. **Incremental** — `syncToken=…`: apply upserts and tombstones, store the
 *      new token.
 *   3. **410 GONE** — the token expired: drop it, emit `sync.status`, and run a
 *      full sync in the same pass so the calendar is never left stale.
 *
 * Pure orchestration over two ports (`GoogleCalendarApi`, `SyncStore`) plus an
 * emitter, so the fixture suite drives every branch with no network and no
 * database.
 */

export type SyncMode = 'initial' | 'incremental';

export type SyncResult = {
  mode: SyncMode;
  /** True when a 410 forced us to discard the token and start over. */
  resynced: boolean;
  upserted: number;
  deleted: number;
  /** Events skipped as our own echo or as an unchanged etag. */
  skipped: number;
  pages: number;
  syncToken: string | null;
};

export type SyncOptions = {
  calendar: CalendarSyncState;
  api: GoogleCalendarApi;
  store: SyncStore;
  emit: Emitter;
  echo?: EchoRegistry;
  now?: () => Date;
};

type Page = { items: GoogleEventResource[]; syncToken: string | null; pages: number };

/** Walks `nextPageToken` to the end; the sync token only arrives on the last page. */
async function collect(
  api: GoogleCalendarApi,
  calendarId: string,
  syncToken: string | null
): Promise<Page> {
  const items: GoogleEventResource[] = [];
  let pageToken: string | null = null;
  let nextSyncToken: string | null = null;
  let pages = 0;

  do {
    const page = await api.listEvents({ calendarId, syncToken, pageToken });
    pages += 1;
    items.push(...(page.items ?? []));
    pageToken = page.nextPageToken ?? null;
    nextSyncToken = page.nextSyncToken ?? nextSyncToken;
  } while (pageToken);

  return { items, syncToken: nextSyncToken, pages };
}

/**
 * Series masters before override instances, so `recurrenceParentId` can be
 * resolved inside the same pass. Google does not guarantee the order, and a
 * dangling parent reference is the classic recurrence-sync bug.
 */
function mastersFirst(items: GoogleEventResource[]): GoogleEventResource[] {
  return [...items].sort((a, b) => {
    const aOverride = a.recurringEventId ? 1 : 0;
    const bOverride = b.recurringEventId ? 1 : 0;
    return aOverride - bOverride;
  });
}

export async function syncCalendar({
  calendar,
  api,
  store,
  emit,
  echo,
  now = () => new Date(),
}: SyncOptions): Promise<SyncResult> {
  let mode: SyncMode = calendar.syncToken ? 'incremental' : 'initial';
  let resynced = false;
  let page: Page;

  try {
    page = await collect(api, calendar.googleCalendarId, calendar.syncToken);
  } catch (error) {
    if (!(error instanceof GoogleApiError) || !error.isGone) throw error;

    // §5: the token expired. Drop it first — if the full sync below fails, the
    // next attempt must not reuse a token Google has already rejected.
    await store.setSyncToken(calendar.id, null, null);
    await emit({
      type: 'sync.status',
      familyId: calendar.familyId,
      entityId: calendar.id,
      patch: { state: 'resyncing', reason: 'sync_token_expired' },
    });

    mode = 'initial';
    resynced = true;
    page = await collect(api, calendar.googleCalendarId, null);
  }

  const applied = await applyItems({ calendar, items: page.items, store, emit, echo, now });

  await store.setSyncToken(calendar.id, page.syncToken, now());

  const result: SyncResult = {
    mode,
    resynced,
    pages: page.pages,
    syncToken: page.syncToken,
    ...applied,
  };

  await emit({
    type: 'sync.status',
    familyId: calendar.familyId,
    entityId: calendar.id,
    patch: {
      state: 'ok',
      mode,
      resynced,
      upserted: applied.upserted,
      deleted: applied.deleted,
      at: now().toISOString(),
    },
  });

  return result;
}

type ApplyCounts = { upserted: number; deleted: number; skipped: number };

async function applyItems({
  calendar,
  items,
  store,
  emit,
  echo,
  now,
}: {
  calendar: CalendarSyncState;
  items: GoogleEventResource[];
  store: SyncStore;
  emit: Emitter;
  echo?: EchoRegistry;
  now: () => Date;
}): Promise<ApplyCounts> {
  const counts: ApplyCounts = { upserted: 0, deleted: 0, skipped: 0 };
  if (items.length === 0) return counts;

  const ordered = mastersFirst(items);
  const existing = await store.findByGoogleIds(
    calendar.id,
    ordered.map((item) => item.id)
  );

  // Google ids we have written in this pass, so an override can find a parent
  // that did not exist when the pass started.
  const localIdByGoogleId = new Map<string, string>();
  for (const [googleId, row] of existing) localIdByGoogleId.set(googleId, row.id);

  for (const item of ordered) {
    if (isTombstone(item)) {
      const removed = await store.tombstone(calendar, item.id, now());
      if (!removed) {
        // A cancellation for something we never stored (or already deleted).
        counts.skipped += 1;
        continue;
      }
      counts.deleted += 1;
      await emit({
        type: 'event.deleted',
        familyId: calendar.familyId,
        entityId: removed.id,
        version: removed.version,
      });
      continue;
    }

    // The calendar's own zone is the fallback for events that carry none
    // (all-day events usually do not) — `undefined` lets the mapper apply
    // DEFAULT_TIMEZONE rather than storing a null zone in a NOT NULL column.
    const mapped: MappedEvent = fromGoogleEvent(item, calendar.timeZone ?? undefined);
    const known = existing.get(item.id);

    if (isEcho(mapped.etag, known?.etag, echo)) {
      counts.skipped += 1;
      continue;
    }

    const parentId = mapped.recurringEventId
      ? (localIdByGoogleId.get(mapped.recurringEventId) ?? null)
      : null;

    const row = await store.upsertEvent(calendar, mapped, parentId);
    localIdByGoogleId.set(mapped.googleEventId, row.id);
    counts.upserted += 1;

    await emit({
      type: 'event.upserted',
      familyId: calendar.familyId,
      entityId: row.id,
      version: row.version,
    });
  }

  return counts;
}

/**
 * §5 echo suppression. An unchanged etag means the row we hold *is* the remote
 * state — whether because we wrote it or because Google resent it — so there is
 * nothing to write and nothing to broadcast.
 */
function isEcho(
  incomingEtag: string | null,
  storedEtag: string | null | undefined,
  echo?: EchoRegistry
): boolean {
  if (!incomingEtag) return false;
  if (storedEtag && storedEtag === incomingEtag) return true;
  return echo?.isOwn(incomingEtag) ?? false;
}
