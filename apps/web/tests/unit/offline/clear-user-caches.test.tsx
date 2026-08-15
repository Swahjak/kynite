import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLEAR_TIMEOUT_MS,
  USER_CACHE_NAMES,
  USER_DATABASE_NAMES,
  clearUserCaches,
  clearUserCachesWithin,
} from '@/components/offline/clear-user-caches';
import { CACHE } from '@/components/offline/sw-strategy';

/**
 * Sign-out's wipe of everything this device cached for a person (M11 review
 * blocker 1).
 *
 * The failure being prevented is concrete and happens on the most ordinary
 * device this product has — a shared tablet. Parent A's `/nl/today` is a
 * rendered document in `kynite-app-pages-v1`, keyed by URL and nothing else.
 * A signs out, B signs in, the network is slow enough to trip the three-second
 * fuse, and B is looking at A's family. No server-side guard is consulted to
 * serve a cache hit, so the only place this can be fixed is here.
 *
 * jsdom has neither Cache Storage nor IndexedDB, which suits: both are faked
 * so the test asserts *what was asked to be deleted* rather than what a
 * particular browser's storage layer happened to do.
 */

type FakeCaches = { deleted: string[]; delete: (name: string) => Promise<boolean> };

function fakeCaches(names: string[]): FakeCaches {
  const store = new Set(names);
  const deleted: string[] = [];
  return {
    deleted,
    delete: async (name: string) => {
      deleted.push(name);
      return store.delete(name);
    },
  };
}

type FakeIndexedDb = {
  deleted: string[];
  open(): { onupgradeneeded: null; onsuccess: null; onerror: null; onblocked: null };
  deleteDatabase(name: string): {
    onsuccess: (() => void) | null;
    onerror: (() => void) | null;
    onblocked: (() => void) | null;
  };
};

/** `blocked` models the real hazard: another tab still holding the database. */
function fakeIndexedDb(options: { blocked?: boolean } = {}): FakeIndexedDb {
  const deleted: string[] = [];
  return {
    deleted,
    // `clearSnapshot()` opens the database first; a store that never succeeds
    // is the safest stand-in — the module must not depend on it.
    open: () => {
      const request = { onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };
      queueMicrotask(() => (request.onerror as (() => void) | null)?.());
      return request;
    },
    deleteDatabase: (name: string) => {
      deleted.push(name);
      const request = { onsuccess: null, onerror: null, onblocked: null } as {
        onsuccess: (() => void) | null;
        onerror: (() => void) | null;
        onblocked: (() => void) | null;
      };
      queueMicrotask(() => {
        if (options.blocked) request.onblocked?.();
        else request.onsuccess?.();
      });
      return request;
    },
  };
}

function install(caches: unknown, indexedDb: unknown): void {
  Object.defineProperty(globalThis, 'caches', {
    value: caches,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'indexedDB', {
    value: indexedDb,
    configurable: true,
    writable: true,
  });
}

describe('clearUserCaches', () => {
  let storage: FakeCaches;
  let database: FakeIndexedDb;

  beforeEach(() => {
    storage = fakeCaches([CACHE.hubShell, CACHE.appPages, CACHE.assets, CACHE.data]);
    database = fakeIndexedDb();
    install(storage, database);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deletes every cache that holds a rendered page or a household’s data', async () => {
    await clearUserCaches();

    expect(storage.deleted).toEqual(expect.arrayContaining([...USER_CACHE_NAMES]));
    expect(USER_CACHE_NAMES).toEqual([CACHE.hubShell, CACHE.appPages, CACHE.data]);
  });

  it('leaves the asset cache alone — fonts and celebrations belong to nobody', async () => {
    await clearUserCaches();

    // Not an optimisation for its own sake: §6 promises a celebration never
    // waits on a network, and that promise is made to the device, not to the
    // session that happens to be open.
    expect(storage.deleted).not.toContain(CACHE.assets);
  });

  it('deletes both IndexedDB stores, the outbox included', async () => {
    await clearUserCaches();

    expect(database.deleted).toEqual(expect.arrayContaining([...USER_DATABASE_NAMES]));
    // The outbox may hold taps that never reached the server. Replaying them
    // under the next person's session would attribute one family's completions
    // to another; losing them is the smaller, local wrong.
    expect(database.deleted).toContain('kynite-realtime');
    expect(database.deleted).toContain('kynite-offline');
  });

  it('resolves even when a delete is blocked by another tab', async () => {
    install(storage, fakeIndexedDb({ blocked: true }));

    // No assertion beyond "this returns": a sign-out that waits on storage
    // strands the person trying to hand the device over.
    await expect(clearUserCaches()).resolves.toBeUndefined();
  });

  it('resolves when the device has no storage APIs at all', async () => {
    install(undefined, undefined);

    await expect(clearUserCaches()).resolves.toBeUndefined();
  });

  it('never rejects when the storage layer throws', async () => {
    install(
      {
        delete: () => {
          throw new Error('quota');
        },
      },
      {
        open: () => {
          throw new Error('quota');
        },
        deleteDatabase: () => {
          throw new Error('quota');
        },
      }
    );

    await expect(clearUserCaches()).resolves.toBeUndefined();
  });

  it('gives up after the timeout rather than blocking the redirect', async () => {
    // A storage layer that never answers at all — the pathological case the
    // fuse exists for.
    install(
      { delete: () => new Promise(() => {}) },
      {
        open: () => ({ onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null }),
        deleteDatabase: () => ({ onsuccess: null, onerror: null, onblocked: null }),
      }
    );

    vi.useFakeTimers();
    const pending = clearUserCachesWithin(CLEAR_TIMEOUT_MS);
    await vi.advanceTimersByTimeAsync(CLEAR_TIMEOUT_MS);

    await expect(pending).resolves.toBeUndefined();
  });
});
