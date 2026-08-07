/**
 * Public surface of the routines slice (docs/architecture.md §2).
 * Cross-module imports go through this file only.
 *
 * Like the calendar barrel, this re-exports the slice's *client* components
 * alongside `server-only` reads: fine for a route file, fatal for another
 * slice's server module. Anything that needs only tables takes them from
 * `@/server/db/schema`; anything that needs only pure logic deep-imports
 * `domain/` (the sanctioned exception in `eslint.config.mjs`).
 */

export {
  COMPLETION_SOURCES,
  STAR_REASONS,
  completion,
  completionSource,
  memberStarBalance,
  routine,
  routineStep,
  starLedger,
  starReason,
  type Completion,
  type CompletionSource,
  type MemberStarBalance,
  type Routine,
  type RoutineSchedule,
  type RoutineStep,
  type StarLedgerEntry,
  type StarReason,
} from './schema';

export {
  DEFAULT_TIME_OF_DAY,
  MAX_GRACE_DAYS,
  WEEKDAYS,
  graceDaysOf,
  isSimpleWeeklyRule,
  isValidTimeOfDay,
  parseTimeOfDay,
  ruleForWeekdays,
  timeOfDayOf,
  weekdaysOfRule,
  type Schedule,
  type Weekday,
} from './domain/schedule';

export {
  TIME_SECTIONS,
  dateKeyOf,
  instantAt,
  isCompletableOn,
  occurrenceStartOn,
  occurrenceStartsBetween,
  occursOn,
  openOccurrence,
  sectionOf,
  timingAt,
  type OccurrenceInput,
  type OpenOccurrence,
  type RoutineState,
  type RoutineTiming,
  type TimeSection,
} from './domain/occurrence';

export {
  PRAISE_KEYS,
  ROUTINE_DONE_KEYS,
  completionSeed,
  praiseKeyFor,
  routineDoneKeyFor,
  type PraiseKey,
  type RoutineDoneKey,
} from './domain/praise';

export {
  completionRatio,
  moveStep,
  orderSteps,
  withSortOrder,
  type MoveDirection,
  type Orderable,
} from './domain/steps';

export { hasGraduated, starsFor, type Awardable } from './domain/stars';

export {
  getRoutine,
  listCompletedSteps,
  listRoutines,
  listSteps,
  type CompletedStep,
  type RoutineWithSteps,
} from './queries';

export {
  completionFailure,
  idleState,
  type ActionState,
  type CompletionState,
} from './action-state';

export { recordCompletion, completeStepSchema, type CompleteStepInput } from './complete';

export {
  completeStepAction,
  createRoutineAction,
  deleteRoutineAction,
  setRoutineRewardAction,
  undoCompletionAction,
  updateRoutineAction,
  type UndoCompletionInput,
} from './actions';

export {
  loadMemberRoutines,
  loadRoutinesPage,
  type BoardOptions,
  type BoardRoutine,
  type BoardSection,
  type BoardStep,
  type RoutineBoard as RoutineBoardData,
  type RoutinesPageData,
} from './page-data';

export { GraduateRoutineButton } from './ui/graduate-routine-button';
export { RoutineBoard } from './ui/routine-board';
export { RoutineCard } from './ui/routine-card';
export { RoutineDialog } from './ui/routine-dialog';
export { RoutineList } from './ui/routine-list';
export { StepRow, type StepRowProps } from './ui/step-row';
export {
  DEFAULT_ROUTINE_ICON,
  ROUTINE_ICONS,
  SECTION_ICONS,
  STEP_ROW_HEIGHT,
  isRoutineIcon,
  routineIconOf,
  type RoutineIcon,
} from './ui/tokens';
