/**
 * Echo suppression (docs/architecture.md §5): "we compare the incoming `etag`
 * to the one we just wrote and skip re-emitting a realtime event for our own
 * writes."
 *
 * Two gates, because they fail in different ways:
 *
 * 1. **Stored-etag equality** (in the sync engine) — if the row already carries
 *    the etag Google is reporting, nothing changed and there is nothing to
 *    emit. Survives a restart, since it reads the database.
 * 2. **This registry** — the etag of a write *we* just made, remembered for a
 *    short TTL. It closes the window where the push response and the webhook
 *    race: the notification can arrive before our own `UPDATE` commits, and
 *    without this the hub would flash a foreign edit for its own change.
 *
 * Bounded by TTL and by a hard cap, so a busy sync cannot grow it without
 * limit. Losing an entry is harmless — gate 1 catches it, or the client
 * re-renders identical data.
 */

const DEFAULT_TTL_MS = 60_000;
const DEFAULT_MAX_ENTRIES = 500;

export type EchoRegistry = {
  /** Remember an etag we just wrote to Google. */
  record(etag: string | null | undefined): void;
  /** True when `etag` is one of ours (and still fresh). */
  isOwn(etag: string | null | undefined): boolean;
  clear(): void;
  readonly size: number;
};

export function createEchoRegistry(options?: {
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
}): EchoRegistry {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const now = options?.now ?? Date.now;
  const entries = new Map<string, number>();

  function prune(): void {
    const cutoff = now() - ttlMs;
    for (const [etag, at] of entries) {
      if (at <= cutoff) entries.delete(etag);
    }
    // Insertion order is chronological, so the oldest keys go first.
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next();
      if (oldest.done) break;
      entries.delete(oldest.value);
    }
  }

  return {
    record(etag) {
      if (!etag) return;
      entries.set(etag, now());
      prune();
    },
    isOwn(etag) {
      if (!etag) return false;
      const at = entries.get(etag);
      if (at === undefined) return false;
      if (at <= now() - ttlMs) {
        entries.delete(etag);
        return false;
      }
      return true;
    },
    clear() {
      entries.clear();
    },
    get size() {
      return entries.size;
    },
  };
}
