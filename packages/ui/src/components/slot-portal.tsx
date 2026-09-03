'use client';

import { useCallback, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Layout-owned slots that pages fill.
 *
 * The stitch mockups put a page-specific control inside the *shell*: the FAB,
 * in the bottom-right corner above the mobile bar. It belongs to a page and is
 * positioned by the shell — and in the App Router a page cannot render into its
 * layout, because the layout is above it in the tree.
 *
 * M21: the calendar's DAY / WEEK / MONTH pill used to be the second such
 * control, portalled into the shell's glass header. That header is gone and the
 * pill went back onto the calendar page, so `HEADER_SLOT_ID` went with it —
 * the FAB is the only slot left.
 *
 * So the shell renders an empty, absolutely-positioned container and the page
 * portals into it by id. The alternative — hoisting the state into the layout
 * and branching on `usePathname()` — would make the shell import every page's
 * concerns, which is the thing the layout exists to avoid.
 *
 * A page that renders `<SlotPortal>` where the slot does not exist (the hub's
 * pair screen, which has no `FabSlot` yet — no device, no board to act on)
 * renders **nothing**. That is deliberate: a FAB escaping onto a wall display
 * with nowhere to portal into is worse than a missing one.
 */
export const FAB_SLOT_ID = 'app-fab-slot';

/** The slot `<div>` never moves or changes identity, so there is nothing to subscribe to. */
const subscribeToNothing = () => () => {};

function useSlotContainer(id: string) {
  // `useSyncExternalStore` with a *server* snapshot of `null` — deliberately,
  // and not the lazy `useState` initializer this used to be.
  //
  // The initializer looks cheaper (one render instead of two) and is wrong: it
  // runs during the **hydration** render, where `document` already exists, so
  // the client's first render produced a portal while the server's had produced
  // nothing. That is a hydration mismatch, and React's recovery from one is to
  // throw the mismatched subtree away and re-create its DOM — while the portal
  // survives that recovery still pointing at the *old*, now-detached slot node.
  // The header pill and the FAB then rendered into a node that was no longer in
  // the document: present in React, invisible on screen, unfindable by any
  // query. It is what took `view-*` and `event-create` off the calendar
  // entirely in M19.
  //
  // This hook is the primitive for exactly that shape — "a value the server
  // cannot know, read from outside React". React uses `getServerSnapshot`
  // through hydration, so the first client render agrees with the server's
  // nothing, and re-renders with the real container once hydration has
  // committed. `getElementById` returns the same node every call, so the
  // snapshot is referentially stable and the re-render happens once.
  const getSnapshot = useCallback(() => document.getElementById(id), [id]);

  return useSyncExternalStore(subscribeToNothing, getSnapshot, () => null);
}

export function SlotPortal({ id, children }: { id: string; children: ReactNode }) {
  const container = useSlotContainer(id);
  if (!container) return null;
  return createPortal(children, container);
}
