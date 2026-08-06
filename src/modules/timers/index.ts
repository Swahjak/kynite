/**
 * Public surface of the timers slice (docs/architecture.md §2).
 * Cross-module imports go through this file only.
 *
 * Like the other slice barrels, this re-exports the slice's *client*
 * components alongside `server-only` reads: fine for a route file, fatal for
 * another slice's server module. Anything that needs only the table takes it
 * from `@/server/db/schema`; anything that needs only the clock deep-imports
 * `domain/` (the sanctioned exception in `eslint.config.mjs`).
 */

export { timer, type Timer } from './schema';

export {
  DEFAULT_WARNING_LEAD_SECONDS,
  DURATION_PRESETS,
  MAX_DURATION_SECONDS,
  OVERRUN_VISIBLE_SECONDS,
  WARNING_LEAD_PRESETS,
  clockOffsetMs,
  endsAtMs,
  formatCountdown,
  isOnBoard,
  isWarningDue,
  minutesRemaining,
  nextTickDelayMs,
  overrunSeconds,
  phaseOf,
  progressRatio,
  remainingMs,
  remainingSeconds,
  serverNowFrom,
  toMillis,
  type TimerClock,
  type TimerPhase,
} from './domain/countdown';

export {
  CHIME_INTENSITIES,
  CHIME_STORAGE_KEY,
  CHIME_TONE,
  DEFAULT_CHIME,
  OVERRUN_PULSE_MS,
  chimeGain,
  isChimeAudible,
  isNonStrobing,
  parseChimeSetting,
  type ChimeIntensity,
  type ChimeSetting,
} from './domain/chime';

export { getTimer, listRecentTimers, listRunningTimers, type TimerWithMember } from './queries';

export {
  idleState,
  type ActionState,
  type StartTimerState,
  type StopTimerState,
} from './action-state';

export {
  startTimerAction,
  stopTimerAction,
  type StartTimerInput,
  type StopTimerInput,
} from './actions';

export {
  loadTimerBoard,
  loadTimersPage,
  type StepTimerOption,
  type TimerBoardData,
  type TimersPageData,
  type TimerView,
} from './page-data';

export { AmbientTimers } from './ui/ambient-timers';
export { ChimeSettings } from './ui/chime-settings';
export { TimerBoard } from './ui/timer-board';
export { TimerControls } from './ui/timer-controls';
export { TimerTile, type TimerTileCopy, type TimerTileProps } from './ui/timer-tile';
export {
  TIMER_CHANNEL_ENDPOINT,
  TIMER_POLL_INTERVAL_MS,
  useTimerChannel,
  type TimerChannel,
} from './ui/use-timer-channel';
export { useChime, type Chime } from './ui/use-chime';
export { useServerNow } from './ui/use-server-now';
export {
  COUNTDOWN_DIGIT_CLASS,
  COUNTDOWN_DIGIT_CLASS_COMPACT,
  OVERRUN_PULSE_STYLE,
  TIMER_TAP_TARGET_CLASS,
} from './ui/tokens';
