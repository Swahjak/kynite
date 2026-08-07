'use client';

/**
 * Wiping everything this device cached *for a person* (docs/architecture.md §6,
 * FR21; M11 review blocker 1).
 *
 * The offline surface is a per-principal cache with no principal in its keys.
 * The service worker stores rendered documents by URL — `/nl/today` is one key
 * whoever is signed in — and `schedule-cache.ts` mirrors the board to
 * IndexedDB. On a shared device that combination survives a sign-out: parent A
 * caches their `/nl/today`, signs out, B signs in, the network hiccups past
 * `APP_NETWORK_TIMEOUT_SECONDS`, and the worker paints A's family on B's
 * screen. Every guard in the app is server-side, and none of them is consulted
 * to serve a cache hit.
 *
 * So sign-out clears it. The rule for *what* is clear: anything that could
 * carry a household's content goes, anything principal-free stays.
 *
 *   go    the page caches (rendered HTML per family) and the data cache (JSON
 *         reads), plus both IndexedDB databases
 *   stay  `CACHE.assets` — fonts, icons, celebration art, build output. It is
 *         identical for every account, it is the expensive one to refill, and
 *         §6's "celebrations must never wait on a network" is a promise made
 *         to the *device*, not to a session.
 *
 * **The outbox goes too, and that is deliberate.** `kynite-realtime` may hold
 * taps that have not reached the server yet. Keeping them would replay one
 * family's completions under the next session's browser; dropping them loses
 * at most a few queued taps belonging to someone who has just signed out on a
 * shared device. Losing an unsent tap is a small, local wrong; sending it as
 * somebody else is not.
 *
 * Done from the window, not through the worker: `caches` and `indexedDB` are
 * both available here, and a `postMessage` to the worker would have to wait
 * for one to be *controlling* — which it is not on the very first visit, the
 * exact case where a message would silently do nothing.
 */

import { OUTBOX_DB_NAME } from '@/components/realtime';
import { SNAPSHOT_DB_NAME, clearSnapshot } from './schedule-cache';
import { CACHE } from './sw-strategy';

/** Caches whose entries were produced for whoever was signed in. */
export const USER_CACHE_NAMES: readonly string[] = [CACHE.hubShell, CACHE.appPages, CACHE.data];

/** Both hand-rolled IndexedDB stores. Neither is scoped by principal. */
export const USER_DATABASE_NAMES: readonly string[] = [SNAPSHOT_DB_NAME, OUTBOX_DB_NAME];

/**
 * How long sign-out is willing to wait for the wipe.
 *
 * A sign-out that hangs is worse than one that leaves a cache behind: the
 * person in front of the device is trying to hand it to someone else. Two
 * seconds is far more than the operation needs (it is a handful of local
 * deletes) and is only ever reached when `deleteDatabase` is blocked by
 * another tab holding the database open.
 */
export const CLEAR_TIMEOUT_MS = 2000;

function deleteDatabase(name: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return Promise.resolve();

  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.deleteDatabase(name);
    } catch {
      resolve();
      return;
    }
    request.onsuccess = () => resolve();
    // `blocked` fires when another tab still holds a connection. Resolving
    // rather than waiting is the honest answer: the delete is queued and will
    // complete when that tab closes, and sign-out must not depend on it.
    request.onblocked = () => resolve();
    request.onerror = () => resolve();
  });
}

async function deleteCache(name: string): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(name);
  } catch {
    // A storage error is not a reason to refuse to sign out.
  }
}

/**
 * Delete every principal-bearing cache and database on this device.
 *
 * Never rejects: each step swallows its own failure, because the caller's next
 * line is a redirect that must happen either way.
 */
export async function clearUserCaches(): Promise<void> {
  // Delete the mirrored board *through* the store before dropping the whole
  // database. Not redundant: `deleteDatabase` is blocked while another tab
  // holds a connection, and this path is not — so the one row that would
  // otherwise render another family's board is gone either way.
  await clearSnapshot('hub-board');

  await Promise.all([
    ...USER_CACHE_NAMES.map(deleteCache),
    ...USER_DATABASE_NAMES.map(deleteDatabase),
  ]);
}

/** `clearUserCaches()` with a fuse, so sign-out can `await` it unconditionally. */
export function clearUserCachesWithin(timeoutMs: number = CLEAR_TIMEOUT_MS): Promise<void> {
  return Promise.race([
    clearUserCaches(),
    new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    }),
  ]);
}
