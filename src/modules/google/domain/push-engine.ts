import { GoogleApiError } from './errors';
import { googleEventIdFor } from './ids';
import { fromGoogleEvent, toGoogleEvent, type WritableEvent } from './mapping';
import { resolveConflict } from './lww';
import type { CalendarSyncState, Emitter, GoogleCalendarApi, MappedEvent } from './types';
import type { EchoRegistry } from './echo';

/**
 * Kynite → Google (docs/architecture.md §5 "Write path (2-way)").
 *
 * The engine is pure orchestration; the Server Action has already written
 * locally and bumped `version`. Two invariants shape it:
 *
 * - **Idempotence.** The Google event id is minted from our row id and claimed
 *   *before* the network call (see `domain/ids.ts`), so a retry after a lost
 *   response can never create a second Google event — it collides with itself
 *   and reports `409`, which we read as "already landed".
 * - **`If-Match` on every mutation.** A `412` means the remote moved first, so
 *   we refetch and apply last-write-wins by `updated`, ties to Google.
 */

export type PushableEvent = WritableEvent & {
  id: string;
  googleEventId: string | null;
  etag: string | null;
  /** Local write time — the local side of the LWW comparison. */
  updatedAt: Date;
  deletedAt: Date | null;
};

export type PushOutcome =
  | 'inserted'
  | 'updated'
  | 'deleted'
  /** The remote copy was newer: we discarded our write and took Google's. */
  | 'remote-wins'
  /** Nothing to do — a local-only event that was deleted before it ever synced. */
  | 'noop';

export type PushResult = {
  outcome: PushOutcome;
  googleEventId: string | null;
  etag: string | null;
};

export interface PushStore {
  /**
   * Persist `googleEventId` on the row *before* the insert call. Returns the
   * id actually stored, which may be one an earlier attempt already claimed.
   */
  claimGoogleEventId(eventId: string, googleEventId: string): Promise<string>;
  /** Record what Google returned: etag + `updated`, and the id on first push. */
  recordPush(
    eventId: string,
    patch: { googleEventId?: string; etag: string | null; updatedAtRemote: Date | null }
  ): Promise<void>;
  /** LWW went to Google: overwrite the local row from the remote resource. */
  applyRemote(
    calendar: CalendarSyncState,
    input: MappedEvent
  ): Promise<{ id: string; version: number }>;
}

export type PushOptions = {
  event: PushableEvent;
  calendar: CalendarSyncState;
  api: GoogleCalendarApi;
  store: PushStore;
  emit: Emitter;
  echo?: EchoRegistry;
};

export async function pushEvent({
  event,
  calendar,
  api,
  store,
  emit,
  echo,
}: PushOptions): Promise<PushResult> {
  if (event.deletedAt) return pushDelete({ event, calendar, api, store, emit, echo });
  if (!event.googleEventId) return pushInsert({ event, calendar, api, store, emit, echo });
  return pushUpdate({ event, calendar, api, store, emit, echo });
}

async function pushInsert({ event, calendar, api, store, echo }: PushOptions): Promise<PushResult> {
  const claimed = await store.claimGoogleEventId(event.id, googleEventIdFor(event.id));
  const body = toGoogleEvent(event, claimed);

  let resource;
  try {
    resource = await api.insertEvent(calendar.googleCalendarId, body);
  } catch (error) {
    if (!(error instanceof GoogleApiError) || !error.isDuplicate) throw error;
    // A previous attempt landed and we never saw the response. The id is ours
    // by construction, so this is our event — adopt it rather than duplicating.
    resource = await api.getEvent(calendar.googleCalendarId, claimed);
  }

  return finish(store, echo, event.id, resource.id, resource, 'inserted');
}

async function pushUpdate({
  event,
  calendar,
  api,
  store,
  emit,
  echo,
}: PushOptions): Promise<PushResult> {
  const googleEventId = event.googleEventId!;
  const body = toGoogleEvent(event);

  try {
    const resource = await api.patchEvent(
      calendar.googleCalendarId,
      googleEventId,
      body,
      event.etag
    );
    return finish(store, echo, event.id, googleEventId, resource, 'updated');
  } catch (error) {
    if (!(error instanceof GoogleApiError)) throw error;

    if (error.isNotFound) {
      // Deleted remotely while we were editing: recreate under the same id, so
      // the local row keeps its identity.
      let resource;
      try {
        resource = await api.insertEvent(calendar.googleCalendarId, {
          ...body,
          id: googleEventId,
        });
      } catch (insertError) {
        if (!(insertError instanceof GoogleApiError) || !insertError.isDuplicate) throw insertError;
        // Same race `pushInsert` guards against: a previous retry's re-insert
        // already landed and we never saw the response. The id is ours by
        // construction, so adopt what is there rather than treating the
        // collision as a failure.
        resource = await api.getEvent(calendar.googleCalendarId, googleEventId);
      }
      return finish(store, echo, event.id, googleEventId, resource, 'inserted');
    }

    if (!error.isPreconditionFailed) throw error;

    // §5: remote changed first. Refetch and resolve last-write-wins.
    const remote = await api.getEvent(calendar.googleCalendarId, googleEventId);
    const mapped = fromGoogleEvent(remote, event.tz);
    const winner = resolveConflict({
      localUpdatedAt: event.updatedAt,
      remoteUpdatedAt: mapped.updatedAtRemote,
    });

    if (winner === 'remote') {
      const row = await store.applyRemote(calendar, mapped);
      echo?.record(mapped.etag);
      await emit({
        type: 'event.upserted',
        familyId: calendar.familyId,
        entityId: row.id,
        version: row.version,
      });
      return { outcome: 'remote-wins', googleEventId, etag: mapped.etag };
    }

    // We are newer: retry once against the etag we just learned. A second 412
    // means a third writer is racing us; the job retry will pick it up.
    const resource = await api.patchEvent(
      calendar.googleCalendarId,
      googleEventId,
      body,
      remote.etag ?? null
    );
    return finish(store, echo, event.id, googleEventId, resource, 'updated');
  }
}

async function pushDelete({ event, calendar, api, store }: PushOptions): Promise<PushResult> {
  const googleEventId = event.googleEventId;
  // Never pushed: the local soft delete is the whole story.
  if (!googleEventId) return { outcome: 'noop', googleEventId: null, etag: null };

  try {
    await api.deleteEvent(calendar.googleCalendarId, googleEventId, event.etag);
  } catch (error) {
    if (!(error instanceof GoogleApiError)) throw error;
    // Already gone is the desired end state, not a failure.
    if (error.isNotFound) {
      await store.recordPush(event.id, { etag: null, updatedAtRemote: null });
      return { outcome: 'deleted', googleEventId, etag: null };
    }
    if (!error.isPreconditionFailed) throw error;

    // A delete that loses `If-Match` is still a delete: the local row is
    // tombstoned and LWW on a deletion has no field-level merge to perform.
    // Re-issue unconditionally against the current etag.
    const remote = await api.getEvent(calendar.googleCalendarId, googleEventId);
    await api.deleteEvent(calendar.googleCalendarId, googleEventId, remote.etag ?? null);
  }

  // N12: no `echo.record()` here, deliberately — and no *post*-delete state
  // to record either. Google's cancellation notification (the item
  // `sync-engine.ts`'s `isTombstone()` matches) carries no `etag` to key
  // suppression on, so the echo registry's etag-matching mechanism has
  // nothing to compare against for a deletion either way. Recording the
  // *pre*-delete etag (the old behaviour here) was worse than a no-op: that
  // etag no longer identifies anything and could in principle line up with
  // an unrelated later write. Deletion idempotency instead runs on the
  // deletion marker itself — `store.tombstone`'s `deletedAt IS NOT NULL`
  // guard (`src/modules/google/store.ts`, proven in
  // `tests/integration/google-sync.test.ts`) makes a redelivered/duplicate
  // tombstone a no-op regardless of etag or echo state.
  await store.recordPush(event.id, { etag: null, updatedAtRemote: null });
  return { outcome: 'deleted', googleEventId, etag: null };
}

/** Store what Google returned and remember the etag as our own (echo suppression). */
async function finish(
  store: PushStore,
  echo: EchoRegistry | undefined,
  eventId: string,
  googleEventId: string,
  resource: { etag?: string; updated?: string },
  outcome: PushOutcome
): Promise<PushResult> {
  const etag = resource.etag ?? null;
  const updated = resource.updated ? new Date(resource.updated) : null;

  echo?.record(etag);
  await store.recordPush(eventId, {
    googleEventId,
    etag,
    updatedAtRemote: updated && !Number.isNaN(updated.getTime()) ? updated : null,
  });

  return { outcome, googleEventId, etag };
}
