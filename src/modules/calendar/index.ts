/**
 * Public surface of the calendar slice (docs/architecture.md §2).
 * Cross-module imports go through this file only.
 *
 * Note that this barrel re-exports the slice's *client* components alongside
 * its `server-only` queries. That is fine for a route (which imports it in a
 * server context) but fatal for another slice's server module: pulling this
 * file into one drags a React client graph — and `next-intl`'s client
 * navigation — into plain Node. The Google slice needs only the `event` table
 * and takes it from `@/server/db/schema` for exactly that reason; see the note
 * in `modules/google/store.ts`.
 */

export {
  EVENT_CATEGORIES,
  EVENT_TYPES,
  event,
  eventCategory,
  eventType,
  type Event,
  type EventCategory,
  type EventType,
} from './schema';

export {
  dayKeysOf,
  expandSeries,
  isSeries,
  parseDateLine,
  rulesOf,
  type ExpandableSeries,
  type Occurrence,
} from './domain/expand';

export {
  FREQUENCIES,
  WEEKDAYS,
  occurrencesOf,
  parseDateTimeValue,
  parseRule,
  type Frequency,
  type Rule,
  type Weekday,
} from './domain/rrule';

export {
  AGENDA_DAYS,
  CALENDAR_VIEWS,
  daysOf,
  fetchWindow,
  isCalendarView,
  shiftAnchor,
  viewWindow,
  type CalendarView,
  type Window,
} from './domain/window';

export {
  EVENT_CATEGORIES as CATEGORY_KEYS,
  nearestCategory,
  resolveCategory,
} from './domain/category';

export {
  RECURRENCE_PRESETS,
  presetFor,
  preservesExistingRule,
  ruleForPreset,
  type RecurrencePreset,
} from './domain/presets';

export { addExdate, exdateLine, formatDate, formatDateTime } from './domain/ical';

export {
  MS_PER_DAY,
  MS_PER_HOUR,
  fromWall,
  isSameDay,
  isValidTimeZone,
  minutesIntoDay,
  parseDateKey,
  startOfDay,
  toDateKey,
  toWall,
  type Wall,
} from './domain/zone';

export {
  BUSY_LABEL,
  dayKey,
  getEvent,
  groupByDay,
  groupByMember,
  listEvents,
  type CalendarEvent,
  type EventWindow,
  type ListEventsOptions,
} from './queries';

export { idleState, type ActionState } from './action-state';

export {
  createEventAction,
  deleteEventAction,
  rescheduleEventAction,
  updateEventAction,
  type RescheduleInput,
} from './actions';

export { pushToGoogle } from './sync-bridge';

export { loadCalendarPage, type CalendarPageData, type LoadOptions } from './page-data';

export { AgendaView } from './ui/agenda-view';
export { CalendarShell } from './ui/calendar-shell';
export { EventChip } from './ui/event-chip';
export { EventDialog, type WritableCalendar } from './ui/event-dialog';
export { HubBoard, type HubBoardSnapshot } from './ui/hub-board';
export { MonthView } from './ui/month-view';
export { PersonColumns } from './ui/person-columns';
export { TimeGrid } from './ui/time-grid';
export { CATEGORY_CLASSES, EVENT_TYPE_ICONS, HOUR_HEIGHT, SNAP_MINUTES } from './ui/tokens';
