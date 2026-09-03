'use client';

import { useState, type MouseEvent, type ReactNode, type CSSProperties } from 'react';
import type { Member } from '@/modules/family';
import { EventDialog, type WritableCalendar } from './event-dialog';

/**
 * "Nieuw event" as one action inside `modules/today`'s `TodayFab`
 * (M27-ish — the FAB speed dial).
 *
 * It lives in this slice for the same reason it always did: `EventDialog` is
 * the calendar's own component, and `modules/today` may not reach it —
 * `@/modules/calendar` re-exports `server-only` queries, so importing the
 * barrel from the browser graph fails the build, and the deep import is
 * banned by `eslint.config.mjs`. So the slice that owns the dialog owns the
 * trigger, and the page hands the day panel a finished element — the same
 * pattern `TaskComposerFabAction` and the old `TodayQuickActions`'
 * `newEventAction` slot used, one layer further in: this isn't a whole button
 * any more, it's the `render` half of one `FabSpeedDialAction`.
 *
 * `@kynite/ui`'s `FabSpeedDial` clones whatever is passed as an action's
 * `render` with its own `className`, `children`, `onClick` (composed over
 * whatever this element already carried) and a few ARIA/test attributes, then
 * renders the result. So this component has to accept and forward every one
 * of those rather than build its own trigger chrome — it is the element, not
 * a wrapper around one. The `open` state it needs (to mount `EventDialog`)
 * lives here, entirely locally: the dial itself neither knows nor cares that
 * one of its actions opens a dialog instead of navigating.
 */
export type AddEventFabActionProps = {
  members: Member[];
  calendars: WritableCalendar[];
  timeZone: string;
  /** Prefilled start — "now, rounded up" on `/today`. */
  defaultStart?: Date;
  // The props `FabSpeedDial` clones onto `action.render`.
  className?: string;
  children?: ReactNode;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  style?: CSSProperties;
  'aria-disabled'?: boolean;
  tabIndex?: number;
  'data-testid'?: string;
};

export function AddEventFabAction({
  members,
  calendars,
  timeZone,
  defaultStart,
  onClick,
  children,
  ...cloneProps
}: AddEventFabActionProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        {...cloneProps}
        onClick={(event) => {
          onClick?.(event);
          setOpen(true);
        }}
      >
        {children}
      </button>
      {/* Remounted per opening, so every field re-seeds from `defaultStart`
          instead of keeping the state of the last create that was cancelled —
          the same `key` trick `CalendarShell` uses on its own dialog. */}
      {open ? (
        <EventDialog
          key={String(defaultStart?.getTime() ?? 'now')}
          open={open}
          onOpenChange={setOpen}
          members={members}
          calendars={calendars}
          timeZone={timeZone}
          defaultStart={defaultStart}
        />
      ) : null}
    </>
  );
}
