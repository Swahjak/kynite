'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Which shape the `/today` day board takes: one column per person, or one
 * merged chronological list of everybody's day.
 *
 * The choice is *per device*, not per household — the same parent wants the
 * merged list on a phone and the columns on the tablet propped in the kitchen
 * — so it lives in `localStorage` next to the hub theme and the timer chime
 * rather than in the family row. There is no server round trip and nothing to
 * save: switching is a re-render over data the page already fetched, exactly
 * like the calendar's own view pill.
 *
 * `localStorage` *is* external state, so it is read through
 * `useSyncExternalStore` (the pattern `use-hub-theme.ts` and `use-chime.ts`
 * established here). Reading it during render would break hydration; reading
 * it in an effect would paint the wrong board first and correct it after.
 * `useSyncExternalStore` has neither problem, and it gives every mounted
 * consumer one shared answer — the toggle and the board cannot disagree.
 */

export const DAY_VIEW_MODES = ['combined', 'columns'] as const;
export type DayViewMode = (typeof DAY_VIEW_MODES)[number];

export const DAY_VIEW_STORAGE_KEY = 'kynite.today.day-view';

/**
 * The default is the merged list.
 *
 * A household is three to five people, and five columns on a 390px phone is
 * five slivers behind a horizontal scroll — the rail exists because that case
 * is unavoidable, not because it is good. The merged list answers the question
 * `/today` is actually opened for ("what is happening today, and when") in one
 * readable column at every width, and the columns stay one tap away for the
 * "what does *Daan* have" question they are genuinely better at.
 */
export const DEFAULT_DAY_VIEW: DayViewMode = 'combined';

/** Anything at all — a stale key, a hand-edited value — narrowed to a mode. */
export function parseDayViewMode(value: unknown): DayViewMode {
  return DAY_VIEW_MODES.includes(value as DayViewMode) ? (value as DayViewMode) : DEFAULT_DAY_VIEW;
}

const store = {
  mode: DEFAULT_DAY_VIEW as DayViewMode,
  loaded: false,
  listeners: new Set<() => void>(),
};

function subscribe(listener: () => void): () => void {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

function snapshot(): DayViewMode {
  if (!store.loaded) {
    store.loaded = true;
    try {
      store.mode = parseDayViewMode(window.localStorage.getItem(DAY_VIEW_STORAGE_KEY));
    } catch {
      // A locked-down profile, or storage disabled. The default is fine.
    }
  }
  return store.mode;
}

/** The server has no device, so it renders the default and hydrates over it. */
function serverSnapshot(): DayViewMode {
  return DEFAULT_DAY_VIEW;
}

export function useDayViewMode(): {
  mode: DayViewMode;
  setMode: (next: DayViewMode) => void;
} {
  const mode = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  const setMode = useCallback((next: DayViewMode) => {
    store.mode = next;
    store.loaded = true;
    try {
      window.localStorage.setItem(DAY_VIEW_STORAGE_KEY, next);
    } catch {
      // Keep the in-memory choice and move on.
    }
    for (const listener of store.listeners) listener();
  }, []);

  return { mode, setMode };
}
