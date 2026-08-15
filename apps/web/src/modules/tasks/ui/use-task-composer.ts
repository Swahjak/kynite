'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether the task list's quick-add field is open.
 *
 * It is a module store rather than `useState` inside `TaskList` because since
 * the August sheet the *button* and the *field* live in different components:
 * the wall board promotes "Taak erbij" into the quick-action grid at the top of
 * its third column, while the field it opens stays inside the task list further
 * down. Lifting the state to a common parent would mean threading a prop
 * through the whole board composition — through a server component — for one
 * boolean.
 *
 * Same shape as `today/ui/use-today-tab.ts`, minus the persistence: an open
 * composer is a thing you are doing right now, not a preference, so it starts
 * closed on every load.
 */

const store = {
  open: false,
  listeners: new Set<() => void>(),
};

function emit() {
  for (const listener of store.listeners) listener();
}

function subscribe(listener: () => void): () => void {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

function snapshot(): boolean {
  return store.open;
}

/** The server has no composer open; it renders closed and hydrates over it. */
function serverSnapshot(): boolean {
  return false;
}

export function openTaskComposer(): void {
  if (store.open) return;
  store.open = true;
  emit();
}

export function useTaskComposer(): { open: boolean; setOpen: (next: boolean) => void } {
  const open = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  const setOpen = useCallback((next: boolean) => {
    if (store.open === next) return;
    store.open = next;
    emit();
  }, []);

  return { open, setOpen };
}
