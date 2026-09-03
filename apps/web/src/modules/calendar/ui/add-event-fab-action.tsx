'use client';

import { useState, type MouseEvent, type ReactNode, type CSSProperties } from 'react';
import { useFabSpeedDialAction } from '@kynite/ui';
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
 * a wrapper around one.
 *
 * That clone only works when React hands `FabSpeedDial` this element with a
 * readable `.props` — crossing the Server→Client boundary (this page is a
 * Server Component, `TodayFab` a client one) React Flight may instead deliver
 * it as a lazy reference `cloneElement` cannot read. When that happens
 * `FabSpeedDial` renders this element as-is and hands the same chrome down
 * through `useFabSpeedDialAction()` instead — hence the fallback below. The
 * `open` state it needs (to mount `EventDialog`) lives here, entirely
 * locally: the dial itself neither knows nor cares that one of its actions
 * opens a dialog instead of navigating.
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
  // Fallback for when `FabSpeedDial` could not `cloneElement` this element
  // (see `FabSpeedDialActionSlot`) — `null` on the ordinary clone path, where
  // `cloneProps` already carries everything below directly.
  const slot = useFabSpeedDialAction();

  const buttonClassName = cloneProps.className ?? slot?.className;
  const kids = children ?? slot?.children;
  const style = cloneProps.style ?? slot?.style;
  const testId = cloneProps['data-testid'] ?? slot?.['data-testid'];
  const ariaDisabled = cloneProps['aria-disabled'] ?? slot?.disabled;

  return (
    <>
      <button
        type="button"
        {...cloneProps}
        className={buttonClassName}
        style={style}
        aria-disabled={ariaDisabled}
        data-testid={testId}
        onClick={(event) => {
          onClick?.(event);
          setOpen(true);
          // No-op on the clone path — `FabSpeedDial` already composed the
          // close into `onClick` above.
          slot?.onClick(event);
        }}
      >
        {kids}
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
