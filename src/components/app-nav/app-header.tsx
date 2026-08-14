import type { ReactNode } from 'react';
import { HEADER_SLOT_ID } from '@/components/ui/slot-portal';
import { AppClock } from './app-clock';

/**
 * The shell's glass top bar — `docs/design/stitch/` (`h-20`, `bg-surface/80
 * backdrop-blur-xl`, weekday + live clock on the left, a segmented view pill in
 * the middle, avatar on the right).
 *
 * Sticky rather than `fixed`: the mockups' `fixed` header is paired with a
 * `pt-14`/`pt-20` push on `<main>`, which is the same result with one more
 * number to keep in sync. Sticky keeps the glass effect (the content scrolls
 * *under* it) with no magic offset.
 *
 * The middle is a slot, not a prop: the DAY/WEEK/MONTH pill belongs to
 * `/calendar` and phase 2 moves it here with `<SlotPortal id={HEADER_SLOT_ID}>`
 * rather than by teaching the shell about calendar views.
 */
export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="glass pt-safe sticky top-0 z-30 flex h-20 items-center gap-4 px-4 sm:px-6">
      <AppClock />
      {/* Grows to fill, so the pill lands centred between clock and avatar. */}
      <div id={HEADER_SLOT_ID} className="flex flex-1 items-center justify-center" />
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </header>
  );
}
