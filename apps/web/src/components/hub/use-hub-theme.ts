'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  HUB_THEME_STORAGE_KEY,
  parseHubThemeMode,
  resolveHubTheme,
  type HubThemeMode,
  type ResolvedHubTheme,
} from './hub-theme';

/**
 * Resolves the kiosk theme and applies it to `<html>`.
 *
 * Every input is an *external* store — the stored mode, the OS colour-scheme
 * query, the wall clock — so all three are read through
 * `useSyncExternalStore` and the theme is computed during render. That is not
 * ceremony: reading `localStorage` or `matchMedia` during render breaks
 * hydration, and reading them in an effect means painting light first and
 * correcting after, which on a wall display in a dark kitchen is a flash of
 * white across the room. `useSyncExternalStore` is the primitive that has
 * neither problem, and it gives every mounted hub surface one shared answer.
 *
 * The `.dark` class and the `data-surface="hub"` attribute go on the document
 * element rather than on the shell `div`, because portalled surfaces — sheets,
 * dialogs, toasts — render outside the shell's subtree and would otherwise come
 * back light, and phone-sized, on a dark 6-foot board. Both are removed on
 * unmount so navigating back to the parent app does not inherit them.
 */

/** Coarse on purpose: the only boundary it exists for is 20:00. */
const CLOCK_TICK_MS = 60_000;

const modeStore = {
  mode: 'auto' as HubThemeMode,
  loaded: false,
  listeners: new Set<() => void>(),
};

function subscribeMode(listener: () => void): () => void {
  modeStore.listeners.add(listener);
  return () => {
    modeStore.listeners.delete(listener);
  };
}

function modeSnapshot(): HubThemeMode {
  if (!modeStore.loaded) {
    modeStore.loaded = true;
    try {
      modeStore.mode = parseHubThemeMode(window.localStorage.getItem(HUB_THEME_STORAGE_KEY));
    } catch {
      // A locked-down kiosk profile. `auto` is a fine answer.
    }
  }
  return modeStore.mode;
}

function modeServerSnapshot(): HubThemeMode {
  return 'auto';
}

function writeMode(next: HubThemeMode): void {
  modeStore.mode = next;
  modeStore.loaded = true;
  try {
    window.localStorage.setItem(HUB_THEME_STORAGE_KEY, next);
  } catch {
    // Keep the in-memory choice and move on.
  }
  for (const listener of modeStore.listeners) listener();
}

const DARK_QUERY = '(prefers-color-scheme: dark)';
const NO_PREFERENCE_QUERY = '(prefers-color-scheme: no-preference)';

function subscribeScheme(listener: () => void): () => void {
  const query = window.matchMedia?.(DARK_QUERY);
  query?.addEventListener('change', listener);
  return () => query?.removeEventListener('change', listener);
}

/** `null` when the device expresses no preference — not the same as light. */
function schemeSnapshot(): boolean | null {
  if (window.matchMedia?.(NO_PREFERENCE_QUERY).matches) return null;
  const query = window.matchMedia?.(DARK_QUERY);
  return query ? query.matches : null;
}

function schemeServerSnapshot(): boolean | null {
  return null;
}

function subscribeHour(listener: () => void): () => void {
  const timer = setInterval(listener, CLOCK_TICK_MS);
  return () => clearInterval(timer);
}

function hourSnapshot(): number {
  return new Date().getHours();
}

/**
 * Noon on the server: the *only* thing the hour feeds is the fallback for a
 * device that reports no colour-scheme preference at all, and a server render
 * that guessed "dark" would hand every such tablet a flash of the wrong theme
 * on hydration. Guessing "day" is the quieter wrong answer, and it is corrected
 * within one paint.
 */
function hourServerSnapshot(): number {
  return 12;
}

export function useHubTheme(override?: ResolvedHubTheme): {
  mode: HubThemeMode;
  theme: ResolvedHubTheme;
  setMode: (next: HubThemeMode) => void;
} {
  const mode = useSyncExternalStore(subscribeMode, modeSnapshot, modeServerSnapshot);
  const systemPrefersDark = useSyncExternalStore(
    subscribeScheme,
    schemeSnapshot,
    schemeServerSnapshot
  );
  const hour = useSyncExternalStore(subscribeHour, hourSnapshot, hourServerSnapshot);

  const theme = override ?? resolveHubTheme({ mode, systemPrefersDark, hour });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.hubTheme = theme;
    root.dataset.surface = 'hub';
    return () => {
      root.classList.remove('dark');
      delete root.dataset.hubTheme;
      delete root.dataset.surface;
    };
  }, [theme]);

  const setMode = useCallback((next: HubThemeMode) => writeMode(next), []);

  return { mode, theme, setMode };
}
