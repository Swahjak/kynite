/**
 * Public surface of the today slice (docs/architecture.md §2).
 * Cross-module imports go through this file only.
 *
 * The slice is a *composition*, not a new domain: `/today` reads the calendar's
 * events through `loadCalendarPage` and the routines/rewards facts through
 * their own queries, and this slice owns only the two things neither of them
 * has — the shape of a day (`domain/flow.ts`), the shape of the star grid
 * (`domain/star-matrix.ts`) and the screens that draw them.
 *
 * There is no `schema.ts` and no `actions.ts` here, deliberately. The star
 * matrix does write — a parent tapping a cell ticks a routine step off — but
 * it writes through the routines slice's own `completeStepAction` /
 * `undoCompletionAction`, so a star earned here is the same star, on the same
 * ledger, as one earned on the hub. A local action would be a second answer to
 * a question this product already answers once.
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

export { resolveTodayTheme, type ResolveTodayThemeInput, type TodayTheme } from './domain/theme';

export {
  resolveStepIcon,
  starMatrixRows,
  type StarMatrixMember,
  type StarMatrixRow,
  type StarMatrixStep,
} from './domain/star-matrix';

export { loadTodayProgress, type KidProgress, type TodayProgressData } from './page-data';

export { StarMatrix, type StarMatrixColumn, type StarMatrixProps } from './ui/star-matrix';

export { KidStatCard, type KidStatCardProps } from './ui/kid-stat-card';
export { MemberFaces, joinNames, namesOf, participantsOf } from './ui/member-faces';
export { TodayClock, type TodayClockProps } from './ui/today-clock';
export { TodayHeader, type TodayHeaderProps } from './ui/today-header';
export { TodayLive } from './ui/today-live';
export { TodayThemeBanner, type TodayThemeBannerProps } from './ui/today-theme-banner';
export { TodayTimeline, type TodayTimelineProps } from './ui/today-timeline';
export { TodayQuickActions, type TodayQuickActionsProps } from './ui/today-quick-actions';
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
