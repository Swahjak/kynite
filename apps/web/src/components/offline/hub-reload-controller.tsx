'use client';

import { useEffect, useRef } from 'react';
import { RELOAD_HUB_MESSAGE, shouldReloadHub } from './reload-gate';

/**
 * Acts on the service worker's `RELOAD_HUB` message — but only when the gate
 * says the moment is safe (docs/architecture.md §6 "Long-run hygiene").
 *
 * The worker skips waiting, so a new build is already live for the *next*
 * navigation; this component decides when this tab takes it. It holds two
 * pieces of state and no rendering:
 *
 *  - `updateReadyAt` — set when the message arrives, and it never clears. A
 *    deferred update stays pending until it is taken.
 *  - `lastInteractionAt` — every pointer/key/touch on the board.
 *
 * The gate is re-evaluated on a slow interval rather than on every event: it
 * is a "nobody has touched this in five minutes" question, so polling once a
 * minute is both sufficient and cheap on a cheap tablet.
 */

/** How often the gate is re-checked while an update is pending. */
export const RELOAD_CHECK_INTERVAL_MS = 60_000;

export function HubReloadController({
  /** Injectable for the test that must not actually navigate. */
  reload,
  enabled = true,
}: {
  reload?: () => void;
  enabled?: boolean;
}) {
  const updateReadyAt = useRef<Date | null>(null);
  const lastInteractionAt = useRef<Date>(new Date());

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const touch = () => {
      lastInteractionAt.current = new Date();
    };
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;
    for (const name of events) window.addEventListener(name, touch, { passive: true });

    const onMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type !== RELOAD_HUB_MESSAGE) return;
      updateReadyAt.current ??= new Date();
    };
    navigator.serviceWorker.addEventListener('message', onMessage);

    const timer = setInterval(() => {
      const ready = updateReadyAt.current;
      if (!ready) return;

      if (
        shouldReloadHub({
          now: new Date(),
          updateReadyAt: ready,
          lastInteractionAt: lastInteractionAt.current,
        })
      ) {
        (reload ?? (() => window.location.reload()))();
      }
    }, RELOAD_CHECK_INTERVAL_MS);

    return () => {
      for (const name of events) window.removeEventListener(name, touch);
      navigator.serviceWorker.removeEventListener('message', onMessage);
      clearInterval(timer);
    };
  }, [reload, enabled]);

  return null;
}
