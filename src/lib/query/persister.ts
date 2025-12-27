import { get, set, del } from "idb-keyval";
import type {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client";
import { CACHE_CONFIG } from "./cache-config";

/**
 * Creates an IndexedDB-backed persister for React Query.
 * Uses idb-keyval for simple key-value storage.
 */
export function createIndexedDBPersister(): Persister {
  const key = `${CACHE_CONFIG.IDB_KEY}-v${CACHE_CONFIG.CACHE_VERSION}`;

  return {
    persistClient: async (client: PersistedClient) => {
      await set(key, client);
    },
    restoreClient: async () => {
      const client = await get<PersistedClient>(key);
      return client ?? undefined;
    },
    removeClient: async () => {
      await del(key);
    },
  };
}

/**
 * Determines if a query should be persisted based on its key.
 * Excludes real-time data (timers) and sensitive data (invites).
 */
export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const keyPrefix = queryKey[0];
  if (typeof keyPrefix !== "string") return true;

  return !CACHE_CONFIG.EXCLUDED_PREFIXES.some((prefix) => keyPrefix === prefix);
}
