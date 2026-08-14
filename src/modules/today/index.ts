/**
 * Public surface of the today slice (docs/architecture.md §2).
 * Cross-module imports go through this file only.
 *
 * The slice is a *composition*, not a new domain: `/today` reads the calendar's
 * events through `loadCalendarPage` and the routines/rewards facts through
 * their own queries, and this slice owns only the two things neither of them
 * has — the shape of a day (`domain/flow.ts`) and the screen that draws it.
 * There is no `schema.ts` and no `actions.ts` here, deliberately: nothing on
 * this page writes.
 *
 * Like the other slice barrels this re-exports server components alongside
 * `server-only` reads, so it is importable from a route file and from nothing
 * in the browser graph.
 */

export {
  UP_NEXT_LIMIT,
  currentBlock,
  elapsedRatio,
  flowOf,
  minutesRemaining,
  minutesUntil,
  upcomingBlocks,
  type DayReference,
  type Flow,
  type FlowMode,
  type ReferenceKind,
  type TimeBlock,
} from './domain/flow';

export { loadTodayProgress, type KidProgress, type TodayProgressData } from './page-data';

export { KidStatCard, type KidStatCardProps } from './ui/kid-stat-card';
export { MemberFaces, joinNames, namesOf, participantsOf } from './ui/member-faces';
export { TodayClock, type TodayClockProps } from './ui/today-clock';
export { TodayHeader, type TodayHeaderProps } from './ui/today-header';
export { TodayLive } from './ui/today-live';
export { TodayNowStrip, type TodayNowStripProps } from './ui/today-now-strip';
export { TodayTabDag, type TodayTabDagProps } from './ui/today-tab-dag';
export { TodayTabPersonen, type TodayTabPersonenProps } from './ui/today-tab-personen';
export { TodayTabRoutines, type TodayTabRoutinesProps } from './ui/today-tab-routines';
export { TodayTabSterren, type TodayTabSterrenProps } from './ui/today-tab-sterren';
export { TodayTabs, type TodayTabsProps } from './ui/today-tabs';
export {
  DEFAULT_TODAY_TAB,
  TODAY_TABS,
  TODAY_TAB_STORAGE_KEY,
  parseTodayTab,
  useTodayTab,
  type TodayTab,
} from './ui/use-today-tab';
