'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * "Is there room for the wide shape of this view?"
 *
 * The calendar is the one screen in the product where a breakpoint cannot be a
 * pure CSS concern. `docs/design/claude-design/Kalender.dc.html` does not scale
 * the views down at 390px, it **changes their shape**: week stops being a
 * seven-column time grid and becomes an agenda list, month stops being a cell
 * grid and becomes a dot grid with the selected day spelled out underneath.
 * Those are different components, not different classes.
 *
 * Rendering both and hiding one with `sm:hidden` is the CSS-only way to do it,
 * and it is rejected for two concrete reasons: it doubles the event DOM on
 * every load (a month of a busy family is hundreds of nodes), and it duplicates
 * the `data-testid`s the E2E suite selects on — `now-line`, `event-create` —
 * into two matches, which is a strict-mode failure even when one of them is
 * `display:none`.
 *
 * So the choice is made once, in JS, and exactly one shape is rendered.
 *
 * `useSyncExternalStore` rather than `useEffect` + `useState`: the server
 * snapshot is the sanctioned way to say "assume wide until the client knows
 * better", and React re-renders with the real value as part of hydration
 * instead of warning about a mismatch.
 */
export function useIsWide(query = '(min-width: 640px)'): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onStoreChange);
      return () => list.removeEventListener('change', onStoreChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => (typeof window === 'undefined' ? true : window.matchMedia(query).matches),
    // The wall tablet and the desktop are the wide case, and a hub that
    // flashed the phone shape on every boot would be the more visible wrong
    // guess of the two.
    () => true
  );
}
