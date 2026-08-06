'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { rescheduleEventAction } from '../actions';
import type { CalendarEvent } from '../queries';
import { HOUR_HEIGHT, SNAP_MINUTES } from './tokens';

/**
 * Drag-and-drop rescheduling for the day and week time grids (M06).
 *
 * Pointer events rather than HTML5 drag-and-drop, for three reasons: HTML5 DnD
 * does not fire on touch at all (the hub is a touch device), it cannot be
 * styled while dragging, and its synthetic drag image is unusable for a block
 * that must stay aligned to a time grid. Pointer events also give us
 * `setPointerCapture`, so a fast drag that leaves the element still tracks.
 *
 * The gesture is preview-only until release: `offset` moves the block visually,
 * and only `pointerup` writes. So an accidental drag costs nothing, and a
 * failed push is still non-blocking — the action returns, the pip appears on
 * the next render, and nothing about the drag is undone.
 */

export type DragState = {
  /** The occurrence being dragged, by `CalendarEvent.key`. */
  key: string;
  /** Whole snap steps moved, vertically (time) and horizontally (day). */
  minuteDelta: number;
  dayDelta: number;
};

export type UseDragRescheduleOptions = {
  /** Column width in px; 0 disables horizontal (day) dragging, as in day view. */
  columnWidth: number;
  /** How many columns exist, so a drag cannot leave the grid. */
  columnCount: number;
  /** Column index the event currently sits in. */
  columnIndexOf: (event: CalendarEvent) => number;
};

const MS_PER_MINUTE = 60_000;
/** Movement under this many pixels is a click, not a drag. */
const DRAG_THRESHOLD_PX = 4;

export function useDragReschedule(options: UseDragRescheduleOptions) {
  const router = useRouter();
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pending, setPending] = useState(false);

  // Everything the move/up handlers need, off the React render path: a
  // pointermove that set state on every frame would re-render the whole grid.
  const gesture = useRef<{
    event: CalendarEvent;
    startX: number;
    startY: number;
    moved: boolean;
    minuteDelta: number;
    dayDelta: number;
  } | null>(null);

  const finish = useCallback(
    async (state: { event: CalendarEvent; minuteDelta: number; dayDelta: number }) => {
      const shiftMs = (state.minuteDelta + state.dayDelta * 24 * 60) * MS_PER_MINUTE;
      if (shiftMs === 0) return;

      const startsAt = new Date(state.event.startsAt.getTime() + shiftMs);
      const endsAt = new Date(state.event.endsAt.getTime() + shiftMs);

      setPending(true);
      try {
        await rescheduleEventAction({
          eventId: state.event.seriesId,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          // Dragging one instance of a series moves that instance alone; the
          // action turns it into an override + EXDATE on the parent.
          ...(state.event.isRecurringInstance || state.event.recurring
            ? { occurrenceStart: state.event.startsAt.toISOString() }
            : {}),
        });
        // No SSE until M10, so the server state is pulled back explicitly.
        router.refresh();
      } finally {
        setPending(false);
      }
    },
    [router]
  );

  const onPointerDown = useCallback(
    (pointerEvent: React.PointerEvent<HTMLElement>, event: CalendarEvent) => {
      // Only a primary-button/touch drag on an editable event, and never on an
      // all-day chip — those do not live on the time grid.
      if (!event.editable || event.allDay || pointerEvent.button !== 0) return;

      gesture.current = {
        event,
        startX: pointerEvent.clientX,
        startY: pointerEvent.clientY,
        moved: false,
        minuteDelta: 0,
        dayDelta: 0,
      };
      pointerEvent.currentTarget.setPointerCapture?.(pointerEvent.pointerId);
    },
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMove = (pointerEvent: PointerEvent) => {
      const current = gesture.current;
      if (!current) return;

      const dx = pointerEvent.clientX - current.startX;
      const dy = pointerEvent.clientY - current.startY;

      if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      current.moved = true;
      // Suppress text selection once this is unambiguously a drag.
      pointerEvent.preventDefault?.();

      const rawMinutes = (dy / HOUR_HEIGHT) * 60;
      current.minuteDelta = Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES;

      if (options.columnWidth > 0) {
        const columnIndex = options.columnIndexOf(current.event);
        const rawDays = Math.round(dx / options.columnWidth);
        // Clamp so a drag off the edge parks at the edge rather than moving
        // the event into a week the view is not showing.
        const target = Math.min(
          Math.max(columnIndex + rawDays, 0),
          Math.max(options.columnCount - 1, 0)
        );
        current.dayDelta = target - columnIndex;
      }

      setDrag({
        key: current.event.key,
        minuteDelta: current.minuteDelta,
        dayDelta: current.dayDelta,
      });
    };

    const handleUp = () => {
      const current = gesture.current;
      gesture.current = null;
      setDrag(null);
      if (!current || !current.moved) return;

      void finish({
        event: current.event,
        minuteDelta: current.minuteDelta,
        dayDelta: current.dayDelta,
      });
    };

    const handleCancel = () => {
      gesture.current = null;
      setDrag(null);
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
    };
  }, [finish, options]);

  /** Visual offset for a block mid-drag; zero for everything else. */
  const offsetFor = useCallback(
    (event: CalendarEvent): { top: number; left: number } => {
      if (!drag || drag.key !== event.key) return { top: 0, left: 0 };
      return {
        top: (drag.minuteDelta / 60) * HOUR_HEIGHT,
        left: drag.dayDelta * options.columnWidth,
      };
    },
    [drag, options.columnWidth]
  );

  return { drag, pending, onPointerDown, offsetFor };
}
