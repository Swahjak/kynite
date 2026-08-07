'use client';

/**
 * The hub's IndexedDB mirror of family state (docs/architecture.md §6, "Family
 * state — mirrored to IndexedDB on every load and every SSE event; boot
 * renders from IDB then reconciles").
 *
 * Why IDB and not just the service worker's page cache: the cached *document*
 * gets a cold hub to a board, but it is a whole HTML response and it is
 * whatever the last successful navigation produced. The mirror is the data
 * behind it — small, structured, and refreshed on every render and every
 * realtime event, so the board a tablet boots to is the most recent state the
 * device ever saw rather than the last time someone happened to navigate.
 *
 * Same shape and same reasons as `@/components/realtime/outbox.ts`: ~100 lines
 * of hand-rolled IndexedDB, one store, one key path. A device with no IDB at
 * all degrades to "renders whatever the network gives it", never to an error.
 */

/** Exported so `clear-user-caches.ts` deletes the database by name, not by guess. */
export const SNAPSHOT_DB_NAME = 'kynite-offline';

const DB_NAME = SNAPSHOT_DB_NAME;
const DB_VERSION = 1;
const STORE = 'family-state';

/**
 * How stale a mirrored snapshot may be before the hub stops presenting it as
 * the schedule.
 *
 * PRD FR21 asks for the last-known schedule "indefinitely", and that is right
 * for a tablet that lost wifi an hour ago. A *week*-old board, though, is not
 * information — showing last Tuesday's routines as today's would be worse than
 * showing nothing, so beyond this the snapshot is dropped.
 */
export const SNAPSHOT_MAX_AGE_MS = 3 * 86_400_000;

export type SnapshotKey = 'hub-board';

export type Snapshot<T> = {
  key: SnapshotKey;
  familyId: string;
  savedAt: number;
  data: T;
};

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  return openDatabase().then(
    (database) =>
      new Promise<T | null>((resolve) => {
        if (!database) {
          resolve(null);
          return;
        }
        try {
          const transaction = database.transaction(STORE, mode);
          const request = work(transaction.objectStore(STORE));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
          transaction.oncomplete = () => database.close();
        } catch {
          resolve(null);
        }
      })
  );
}

/** Mirror a snapshot. Called after every successful render and every SSE event. */
export async function saveSnapshot<T>(key: SnapshotKey, familyId: string, data: T): Promise<void> {
  await run('readwrite', (store) =>
    store.put({ key, familyId, savedAt: Date.now(), data } satisfies Snapshot<T>)
  );
}

/**
 * Read the mirror back.
 *
 * `null` for: no IDB, nothing stored, a snapshot from a *different* family
 * (a shared tablet re-paired to another household must never show the old
 * one's board), or one past `SNAPSHOT_MAX_AGE_MS`.
 */
export async function readSnapshot<T>(
  key: SnapshotKey,
  familyId: string,
  now: number = Date.now()
): Promise<Snapshot<T> | null> {
  const row = await run<Snapshot<T>>('readonly', (store) => store.get(key));
  if (!row) return null;
  if (row.familyId !== familyId) return null;
  if (!isFresh(row, now)) return null;
  return row;
}

/** Pure, so the staleness rule is testable without a browser. */
export function isFresh(
  snapshot: Pick<Snapshot<unknown>, 'savedAt'>,
  now: number = Date.now(),
  maxAgeMs: number = SNAPSHOT_MAX_AGE_MS
): boolean {
  return now - snapshot.savedAt < maxAgeMs;
}

export async function clearSnapshot(key: SnapshotKey): Promise<void> {
  await run('readwrite', (store) => store.delete(key));
}
