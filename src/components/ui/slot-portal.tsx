'use client';

import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Layout-owned slots that pages fill.
 *
 * The stitch mockups put two page-specific controls inside the *shell*: the
 * DAY / WEEK / MONTH pill in the glass header, and the FAB in the bottom-right
 * corner above the mobile bar. Both belong to a page, both are positioned by
 * the shell — and in the App Router a page cannot render into its layout,
 * because the layout is above it in the tree.
 *
 * So the shell renders an empty, absolutely-positioned container and the page
 * portals into it by id. The alternative — hoisting the state into the layout
 * and branching on `usePathname()` — would make the shell import every page's
 * concerns, which is the thing the layout exists to avoid.
 *
 * A page that renders `<SlotPortal>` where the slot does not exist (the hub
 * kiosk shell has neither) renders **nothing**. That is deliberate: a FAB
 * escaping onto a wall display is worse than a missing one, and the kiosk is
 * documented as having no parent-app chrome at all.
 */
export const HEADER_SLOT_ID = 'app-header-slot';
export const FAB_SLOT_ID = 'app-fab-slot';

function useSlotContainer(id: string) {
  // Resolved once, in a lazy `useState` initializer rather than in an effect.
  //
  // On the server there is no `document`, so this renders nothing — correct,
  // because a portal has no server output anyway. On the client the initializer
  // runs during the hydration render, by which point the whole document
  // (including the layout's slot `<div>`) is parsed, so the node is there. The
  // effect version needed a `setState` in an effect to say the same thing, and
  // paid a second render for it.
  const [container] = useState<HTMLElement | null>(() =>
    typeof document === 'undefined' ? null : document.getElementById(id)
  );

  return container;
}

export function SlotPortal({ id, children }: { id: string; children: ReactNode }) {
  const container = useSlotContainer(id);
  if (!container) return null;
  return createPortal(children, container);
}
