'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Which of `/today`'s four views is showing, remembered per device.
 *
 * The same reasoning as `calendar/ui/use-day-view-mode.ts`, which this is
 * modelled on: the choice belongs to the *device*, not the household — a phone
 * in a pocket wants the day list, the tablet on the kitchen wall is left on the
 * star overview — so it lives in `localStorage` rather than in the family row.
 * Every panel's data is already fetched by the page, so switching is a
 * re-render: no request, no spinner, no URL change (which also means a shared
 * `/today` link never carries somebody else's habit).
 *
 * `localStorage` is external state, so it is read through `useSyncExternalStore`
 * — the pattern this codebase settled on in `use-hub-theme.ts`. Reading during
 * render breaks hydration; reading in an effect paints the wrong tab first.
 */

export const TODAY_TABS = ['dag', 'personen', 'routines', 'sterren'] as const;
export type TodayTab = (typeof TODAY_TABS)[number];

export const TODAY_TAB_STORAGE_KEY = 'kynite.today.tab';

/**
 * The day overview is the default, and deliberately so: it is the only tab that
 * answers the question the page is opened for most mornings ("what is happening
 * today, and what still has to be done"). The other three are follow-ups.
 */
export const DEFAULT_TODAY_TAB: TodayTab = 'dag';

/** Anything at all — a stale key, a hand-edited value — narrowed to a tab. */
export function parseTodayTab(value: unknown): TodayTab {
  return TODAY_TABS.includes(value as TodayTab) ? (value as TodayTab) : DEFAULT_TODAY_TAB;
}

/**
 * `null` means "this device has never chosen", which is deliberately *not* the
 * same as "this device chose the default". The wall hub's opening tab comes
 * from the household (`family.hubDefaultView`, FR28) and the parent app's from
 * `DEFAULT_TODAY_TAB`; collapsing the two at rest would mean a hub could never
 * honour a setting it had not yet been tapped away from.
 */
const store = {
  tab: null as TodayTab | null,
  loaded: false,
  listeners: new Set<() => void>(),
};

function subscribe(listener: () => void): () => void {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

function snapshot(): TodayTab | null {
  if (!store.loaded) {
    store.loaded = true;
    try {
      const stored = window.localStorage.getItem(TODAY_TAB_STORAGE_KEY);
      store.tab = stored === null ? null : parseTodayTab(stored);
    } catch {
      // A locked-down profile, or storage disabled. The caller's default is fine.
    }
  }
  return store.tab;
}

/** The server has no device, so it renders the caller's default and hydrates over it. */
function serverSnapshot(): TodayTab | null {
  return null;
}

/**
 * `fallback` is what this surface opens on before anyone has picked a tab on
 * this device — `DEFAULT_TODAY_TAB` in the parent app, the household's hub
 * board setting on the wall.
 */
export function useTodayTab(fallback: TodayTab = DEFAULT_TODAY_TAB): {
  tab: TodayTab;
  setTab: (next: TodayTab) => void;
} {
  const chosen = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const tab = chosen ?? fallback;

  const setTab = useCallback((next: TodayTab) => {
    store.tab = next;
    store.loaded = true;
    try {
      window.localStorage.setItem(TODAY_TAB_STORAGE_KEY, next);
    } catch {
      // Keep the in-memory choice and move on.
    }
    for (const listener of store.listeners) listener();
  }, []);

  return { tab, setTab };
}
