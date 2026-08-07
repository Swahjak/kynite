'use client';

import { useEffect, useRef, useState } from 'react';
import { useRealtimeEvents } from '@/components/realtime';
import { readSnapshot, saveSnapshot } from './schedule-cache';

/**
 * The hub's IndexedDB mirror, read *and* written (docs/architecture.md §6:
 * "Family state — mirrored to IndexedDB on every load and every SSE event;
 * **boot renders from IDB then reconciles**").
 *
 * Why the mirror exists at all, next to the service worker's page cache: the
 * cached *document* gets a cold hub to a board, but it is a whole HTML response
 * frozen at whatever the last successful navigation produced. The mirror is the
 * data behind it — small, structured, and refreshed on every render and every
 * realtime event. When a tablet has been offline for a while, the newest thing
 * on the device is very often the mirror rather than the document: the board
 * kept receiving events until the network went, while the document has not been
 * re-fetched since the last navigation.
 *
 * So the boot order is: render the document (the worker already put it on the
 * wall), then reconcile against the mirror, then let the network overrule both.
 *
 * ## The three rules of the swap
 *
 * 1. **Same family.** `readSnapshot` returns `null` for another household's
 *    snapshot, so a tablet re-paired to a different family can never be
 *    reconciled onto the old one's board. This is the same guard sign-out's
 *    wipe relies on, from the other direction (`clear-user-caches.ts`).
 * 2. **Strictly fresher.** The snapshot replaces the document only when its
 *    `generatedAt` is *newer* than the rendered payload's. Equal means the
 *    document and the mirror are the same board — the ordinary offline reload —
 *    and nothing is swapped.
 * 3. **Live data always wins.** Any fresh server payload — a new `generatedAt`,
 *    which is what a navigation or a router refresh produces — drops the
 *    adopted snapshot on the spot.
 *
 * Rule 3 is why there is deliberately *no* extra "only while the stream is
 * down" condition on the swap. It would gate the swap on a race (whether the
 * `EventSource` opened before an IndexedDB read resolved) while adding no
 * safety: a connected hub that was nonetheless served a stale document is
 * exactly the case where the mirror is the better board, and the moment the
 * server sends a newer one it wins by `generatedAt` anyway.
 *
 * The write follows the same freshness rule, which is what stops a cached
 * document from resetting `savedAt` on every offline reload and keeping a
 * three-day-old board "fresh" forever (`SNAPSHOT_MAX_AGE_MS`).
 */

/** The one field the mirror needs to reason about a payload: when it was made. */
export type MirroredPayload = {
  /**
   * Stamped by the *server* render (`Date.now()` on the server), so comparing
   * two of them compares two server instants and never a tablet's clock.
   */
  generatedAt: number;
};

export function useMirroredHubState<T extends MirroredPayload>(familyId: string, rendered: T): T {
  const [adopted, setAdopted] = useState<T | null>(null);

  // A ref, so the effect can depend on the payload's *content* (`generatedAt`)
  // rather than on the object identity a parent render mints every time.
  // Written in an effect and declared first, so it is current before the
  // reconcile below runs (the shape `realtime-provider.tsx` uses).
  const renderedRef = useRef(rendered);
  useEffect(() => {
    renderedRef.current = rendered;
  }, [rendered]);

  const generatedAt = rendered.generatedAt;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // Read before writing: writing first would overwrite the very snapshot
      // this is meant to compare against.
      const stored = await readSnapshot<T>('hub-board', familyId);
      if (cancelled) return;

      if (stored && stored.data.generatedAt > generatedAt) {
        // The device knows something newer than the document it was served.
        setAdopted(stored.data);
        return;
      }

      setAdopted(null);
      // Only when this render is genuinely newer. Re-saving an equal payload
      // would refresh `savedAt` and make a stale board look eternally fresh.
      if (!stored || generatedAt > stored.data.generatedAt) {
        await saveSnapshot('hub-board', familyId, renderedRef.current);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [familyId, generatedAt]);

  // §6's second trigger. A realtime event means the server is reachable, so
  // what is on screen is live and worth mirroring unconditionally.
  useRealtimeEvents(['event.upserted', 'event.deleted'], () => {
    void saveSnapshot('hub-board', familyId, renderedRef.current);
  });

  return adopted ?? rendered;
}
