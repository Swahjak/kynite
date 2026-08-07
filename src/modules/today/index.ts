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

export { KidsProgress, type KidsProgressProps } from './ui/kids-progress';
export { MemberFaces, participantsOf } from './ui/member-faces';
export { NowHero, type NowHeroProps } from './ui/now-hero';
export { NowHeroClock, type NowHeroClockProps } from './ui/now-hero-clock';
export { ProgressRing, type ProgressRingProps } from './ui/progress-ring';
export { TodayLive } from './ui/today-live';
export { UpNextGrid, type UpNextGridProps } from './ui/up-next-grid';
