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
  SCHEDULE_KINDS,
  WEEKDAYS,
  graceDaysOf,
  isOneOff,
  isSimpleWeeklyRule,
  isValidDateKey,
  isValidTimeOfDay,
  oneOffDateOf,
  parseTimeOfDay,
  ruleForWeekdays,
  timeOfDayOf,
  todayKeyIn,
  weekdaysOfRule,
  type Schedule,
  type ScheduleKind,
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
  listCompletionsOn,
  listRoutines,
  listSteps,
  type CompletedStep,
  type MemberCompletedStep,
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
  completeStep,
  createRoutine,
  deleteRoutine,
  routineSchema,
  setRoutineActive,
  setRoutineReward,
  undoCompletion,
  updateRoutine,
  type RoutineInput,
  type RoutineWriteResult,
  type SetRoutineActiveInput,
  type SetRoutineRewardInput,
  type UpdateRoutineInput,
} from './write';

export {
  completeStepAction,
  createRoutineAction,
  deleteRoutineAction,
  setRoutineActiveAction,
  setRoutineRewardAction,
  undoCompletionAction,
  updateRoutineAction,
  type UndoCompletionInput,
} from './actions';

export {
  bandsOf,
  columnProgress,
  firstOpenRoutineId,
  starsEarnedIn,
  visibleBands,
  type ColumnBand,
  type ColumnProgress,
  type CountableRoutine,
  type OpenableRoutine,
} from './domain/board-columns';

export {
  loadFamilyRoutineTotals,
  loadFamilyRoutines,
  loadMemberRoutines,
  loadRoutinesPage,
  type BoardOptions,
  type BoardRoutine,
  type BoardSection,
  type BoardStep,
  type FamilyBoardRoutine,
  type FamilyRoutineColumn,
  type FamilyRoutinesData,
  type RoutineBoard as RoutineBoardData,
  type RoutinesPageData,
  type RoutineTotals,
} from './page-data';

export { GraduateRoutineButton } from './ui/graduate-routine-button';
export { RoutineGraduationList, type GraduationRoutine } from './ui/routine-graduation-list';
export { RoutineBoard } from './ui/routine-board';
export { RoutineCard, StepRow, type StepRowProps } from '@kynite/ui';
export { RoutineDialog } from './ui/routine-dialog';
export { RoutineManager, type ManagedRoutine } from './ui/routine-manager';
export {
  ACTIVITY_ICONS,
  DEFAULT_ROUTINE_ICON,
  ROUTINE_ICONS,
  ROUTINE_ICON_TILE,
  SECTION_ICONS,
  SECTION_TONE,
  STEP_ROW_HEIGHT,
  isRoutineIcon,
  routineIconOf,
  suggestIcon,
  type ActivityIcon,
  type RoutineIcon,
} from './ui/tokens';
