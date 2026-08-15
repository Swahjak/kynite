/**
 * View windows (FR3: day / week / month / agenda).
 *
 * Two jobs, kept apart on purpose:
 *
 * - **`viewWindow()`** — the range a *view* draws.
 * - **`fetchWindow()`** — the range the *page* queries. It is the union of
 *   every view's window for the same anchor date, so switching day → week →
 *   month → agenda is pure client state with no refetch and no reload (an M06
 *   acceptance criterion). One month-plus-padding query answers all four.
 */

import { addDays, addMonths, daysInMonth, fromWall, toWall, type Wall } from './zone';

export const CALENDAR_VIEWS = ['day', 'week', 'month', 'agenda'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export function isCalendarView(value: unknown): value is CalendarView {
  return typeof value === 'string' && (CALENDAR_VIEWS as readonly string[]).includes(value);
}

/** How far ahead the agenda list runs from its anchor day. */
export const AGENDA_DAYS = 30;

export type Window = { from: Date; to: Date };

function midnight(wall: Wall, timeZone: string): Date {
  return fromWall({ ...wall, hour: 0, minute: 0, second: 0 }, timeZone);
}

/** Monday-first week start containing `wall`. `weekStartsOn` is ISO (1 = Mon). */
export function weekStart(wall: Wall, weekStartsOn: number): Wall {
  const isoDay = new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay();
  const iso = isoDay === 0 ? 7 : isoDay;
  return addDays(wall, -((iso - weekStartsOn + 7) % 7));
}

export type WindowOptions = {
  /** The day the view is centred on. */
  anchor: Date;
  timeZone: string;
  /** `family.weekStartsOn`, ISO numbered. */
  weekStartsOn?: number;
};

/** The range a given view draws, in `[from, to)` form. */
export function viewWindow(view: CalendarView, options: WindowOptions): Window {
  const { anchor, timeZone } = options;
  const weekStartsOn = options.weekStartsOn ?? 1;
  const wall = toWall(anchor, timeZone);

  switch (view) {
    case 'day':
      return { from: midnight(wall, timeZone), to: midnight(addDays(wall, 1), timeZone) };

    case 'week': {
      const start = weekStart(wall, weekStartsOn);
      return { from: midnight(start, timeZone), to: midnight(addDays(start, 7), timeZone) };
    }

    case 'month': {
      // Full weeks, so the grid never renders a ragged first or last row.
      const firstOfMonth: Wall = { ...wall, day: 1 };
      const start = weekStart(firstOfMonth, weekStartsOn);
      const lastOfMonth: Wall = { ...wall, day: daysInMonth(wall.year, wall.month) };
      const endExclusive = addDays(weekStart(lastOfMonth, weekStartsOn), 7);
      return { from: midnight(start, timeZone), to: midnight(endExclusive, timeZone) };
    }

    case 'agenda':
      return {
        from: midnight(wall, timeZone),
        to: midnight(addDays(wall, AGENDA_DAYS), timeZone),
      };
  }
}

/**
 * The one range the page fetches: wide enough that every view can be rendered
 * from it without another query. That is what makes view switching free.
 */
export function fetchWindow(options: WindowOptions): Window {
  const windows = CALENDAR_VIEWS.map((view) => viewWindow(view, options));

  return {
    from: new Date(Math.min(...windows.map((window) => window.from.getTime()))),
    to: new Date(Math.max(...windows.map((window) => window.to.getTime()))),
  };
}

/** The anchor one period earlier/later — what the prev/next arrows produce. */
export function shiftAnchor(view: CalendarView, options: WindowOptions, direction: -1 | 1): Date {
  const { anchor, timeZone } = options;
  const wall = toWall(anchor, timeZone);

  switch (view) {
    case 'day':
      return midnight(addDays(wall, direction), timeZone);
    case 'week':
      return midnight(addDays(wall, 7 * direction), timeZone);
    case 'month':
      // Anchored to the 1st so stepping off the 31st cannot skip a month.
      return midnight(addMonths({ ...wall, day: 1 }, direction), timeZone);
    case 'agenda':
      return midnight(addDays(wall, AGENDA_DAYS * direction), timeZone);
  }
}

/** The consecutive days a view spans, as midnights in `timeZone`. */
export function daysOf(view: CalendarView, options: WindowOptions): Date[] {
  const { from, to } = viewWindow(view, options);
  const { timeZone } = options;

  const days: Date[] = [];
  let cursor = from;
  let guard = 0;

  while (cursor.getTime() < to.getTime() && guard < 400) {
    guard += 1;
    days.push(cursor);
    cursor = midnight(addDays(toWall(cursor, timeZone), 1), timeZone);
  }

  return days;
}
