'use client';

/**
 * The completion outbox (docs/architecture.md §4, step `t+0ms`: "append
 * `{clientId, memberId, stepId, occurrenceDate}` to an IndexedDB outbox").
 *
 * Deliberately ~100 lines of hand-rolled IndexedDB rather than a dependency:
 * it stores one shape, keyed by one field, and the whole contract is "the tap
 * survives a closed tab". The full offline story — service worker, precache,
 * mirrored family state — is M11's; this is only the part the <100ms
 * completion flow cannot be correct without.
 *
 * The invariant that matters is the psychological one (research: a celebration
 * a child has already seen is never rolled back). The queue exists so the
 * *write* can be retried without the *UI* ever having to wait for it, which is
 * what makes "never roll back" implementable rather than merely intended:
 * the tap is durable the moment it is queued, and the row lands idempotently
 * whenever the network returns, because `clientId` is a unique index.
 */

const DB_NAME = 'kynite-realtime';
const DB_VERSION = 1;
const STORE = 'completion-outbox';

export type OutboxCompletion = {
  /** Idempotency key, derived from (member, step, occurrence date). The key path. */
  clientId: string;
  routineId: string;
  routineStepId: string;
  memberId: string;
  occurrenceDate: string;
  source: 'hub' | 'mobile';
  /** Stamped by `enqueueCompletion`, so callers never read a clock in render. */
  queuedAt: number;
};

/** What a caller hands in: the tap, without the bookkeeping. */
export type PendingCompletion = Omit<OutboxCompletion, 'queuedAt'>;

/** `null` when there is no IndexedDB at all (SSR, a locked-down browser). */
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
        database.createObjectStore(STORE, { keyPath: 'clientId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    // A tap must never fail because storage is unavailable — it degrades to
    // "not queued", and the Server Action is still attempted.
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

/** Queue a tap. Called *after* the optimistic flip, never before it. */
export async function enqueueCompletion(entry: PendingCompletion): Promise<void> {
  await run('readwrite', (store) => store.put({ ...entry, queuedAt: Date.now() }));
}

export async function listQueuedCompletions(): Promise<OutboxCompletion[]> {
  const rows = await run<OutboxCompletion[]>('readonly', (store) => store.getAll());
  // Oldest first: a replay should land in the order the taps happened.
  return (rows ?? []).sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function dropCompletion(clientId: string): Promise<void> {
  await run('readwrite', (store) => store.delete(clientId));
}

/**
 * Serialised so a reconnect and an `online` event firing together cannot send
 * the same entry twice. Duplicate sends would still be *safe* — `unique
 * (client_id)` makes the second insert a no-op — but sending them is wasted
 * work, and the lock is two lines.
 */
let flushing: Promise<{ sent: number; kept: number }> | null = null;

export type FlushResult = { sent: number; kept: number };

/**
 * Drain the queue.
 *
 * `send` returns `true` when the write is settled — landed *or* already there
 * (a replay), both of which mean the entry is done. Anything else (a network
 * failure, a throw) leaves the entry queued for the next flush; nothing is
 * dropped because a request failed, which is the whole point of the queue.
 */
export function flushCompletions(
  send: (entry: OutboxCompletion) => Promise<boolean>
): Promise<FlushResult> {
  flushing ??= (async () => {
    let sent = 0;
    let kept = 0;

    for (const entry of await listQueuedCompletions()) {
      let settled: boolean;
      try {
        settled = await send(entry);
      } catch {
        settled = false;
      }

      if (settled) {
        await dropCompletion(entry.clientId);
        sent += 1;
      } else {
        kept += 1;
      }
    }

    return { sent, kept };
  })().finally(() => {
    flushing = null;
  });

  return flushing;
}

/**
 * How often a non-empty outbox retries.
 *
 * The stream coming back is the *fast* trigger and the honest one, but it is
 * not sufficient on its own: a connection that was never dropped (a tab that
 * lost its route to the internet without losing its socket) produces no
 * `open` transition at all, so a queue with nothing to wake it would sit there
 * until the next tap. This interval is the floor under that.
 */
export const OUTBOX_RETRY_INTERVAL_MS = 5000;
