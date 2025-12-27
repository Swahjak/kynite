/**
 * Centralized cache configuration for React Query persistence.
 * Increment CACHE_VERSION when query data shapes change.
 */
export const CACHE_CONFIG = {
  /** Maximum age for persisted cache (24 hours in ms) */
  MAX_AGE: 1000 * 60 * 60 * 24,

  /** Cache buster version - increment when schema changes */
  CACHE_VERSION: 1,

  /** IndexedDB database key */
  IDB_KEY: "family-planner-query-cache",

  /** Query key prefixes to exclude from persistence */
  EXCLUDED_PREFIXES: ["timers", "invite"] as const,

  /** Default stale time for queries (30 seconds) */
  DEFAULT_STALE_TIME: 30_000,
} as const;

export type ExcludedPrefix = (typeof CACHE_CONFIG.EXCLUDED_PREFIXES)[number];
