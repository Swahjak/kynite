/**
 * The timer clock — pure, framework-free, and the single definition of "how
 * much is left" (architecture §2 rule 2).
 *
 * Two ideas carry the whole slice:
 *
 * 1. **The server owns the start, the client owns the tick.** A timer row says
 *    `startedAt` + `durationSeconds`; nothing anywhere stores a remaining
 *    value. Every reader recomputes it, so a hub that reloads, a phone that
 *    joins late and a tablet that was asleep all land on the same second.
 * 2. **The client's own clock is never trusted for state.** A wall tablet with
 *    a clock two hours off is not a hypothetical. The server echoes its own
 *    `now` with every read; the client stores the difference once
 *    (`clockOffsetMs`) and asks `serverNowFrom()` for the time from then on.
 *    The device clock is used only to measure *elapsed* time between echoes,
 *    which it is reliable for even when its absolute value is nonsense.
 */

/** A timer as the clock functions need it — timestamps in any transport shape. */
export type TimerClock = {
  startedAt: Date | string | number;
  durationSeconds: number;
  stoppedAt: Date | string | number | null;
};

/**
 * `running` — counting down. `overrun` — the duration has passed and nobody
 * has stopped it. `stopped` — someone ended it.
 *
 * `overrun` is a plain fact, not a failure: the board says the time is up and
 * keeps the row exactly as calm as it was a second earlier (research
 * §Decisions 1 — nothing on a child-facing surface marks anything).
 */
export type TimerPhase = 'running' | 'overrun' | 'stopped';

export const MAX_DURATION_SECONDS = 4 * 60 * 60;

/** What the Controller offers with one tap. Seconds, ascending. */
export const DURATION_PRESETS = [60, 120, 300, 600, 900] as const;

/** Transition-warning lead times a routine step can carry. */
export const WARNING_LEAD_PRESETS = [60, 120, 300, 600] as const;

/** Research §transitions: a five-minute heads-up is the studied default. */
export const DEFAULT_WARNING_LEAD_SECONDS = 300;

/**
 * Past this, a timer nobody stopped stops being interesting and leaves the
 * board on its own. It is not deleted and not marked — it simply stops being
 * the thing the room is looking at.
 */
export const OVERRUN_VISIBLE_SECONDS = 15 * 60;

export function toMillis(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

/** The instant the countdown reaches zero. */
export function endsAtMs(timer: TimerClock): number {
  return toMillis(timer.startedAt) + timer.durationSeconds * 1000;
}

/** Signed milliseconds until zero — negative once the timer has run over. */
export function remainingMs(timer: TimerClock, nowMs: number): number {
  return endsAtMs(timer) - nowMs;
}

/**
 * Whole seconds still to go, never negative.
 *
 * Rounded *up*, so a countdown reads `1` for the whole final second and hits
 * `0` exactly when the time is up — the way every kitchen timer behaves, and
 * what keeps a digit from being skipped between two ticks.
 */
export function remainingSeconds(timer: TimerClock, nowMs: number): number {
  const left = remainingMs(timer, nowMs);
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

/** Whole seconds past zero, never negative. Rounded down: 0 for the first second. */
export function overrunSeconds(timer: TimerClock, nowMs: number): number {
  const left = remainingMs(timer, nowMs);
  return left < 0 ? Math.floor(-left / 1000) : 0;
}

export function phaseOf(timer: TimerClock, nowMs: number): TimerPhase {
  if (timer.stoppedAt !== null && timer.stoppedAt !== undefined) return 'stopped';
  return remainingMs(timer, nowMs) > 0 ? 'running' : 'overrun';
}

/**
 * Is this timer still worth a place on the board? A stopped timer never is; an
 * overrun one is, until it has been ignored for `OVERRUN_VISIBLE_SECONDS`.
 */
export function isOnBoard(timer: TimerClock, nowMs: number): boolean {
  const phase = phaseOf(timer, nowMs);
  if (phase === 'stopped') return false;
  if (phase === 'running') return true;
  return overrunSeconds(timer, nowMs) < OVERRUN_VISIBLE_SECONDS;
}

/** Elapsed fraction, clamped to 0..1 — what the progress ring draws. */
export function progressRatio(timer: TimerClock, nowMs: number): number {
  if (timer.durationSeconds <= 0) return 1;
  const elapsed = (nowMs - toMillis(timer.startedAt)) / (timer.durationSeconds * 1000);
  return Math.min(1, Math.max(0, elapsed));
}

/** `90` → `1:30`, `3661` → `1:01:01`. Fixed-width minutes/seconds. */
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;

  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  return hours > 0
    ? `${hours}:${mm}:${String(rest).padStart(2, '0')}`
    : `${mm}:${String(rest).padStart(2, '0')}`;
}

/**
 * Whole minutes the warning line announces — always at least 1, so the board
 * never says "in 0 minutes" during the final minute. Rounded up, so it reads
 * 5, 4, 3, 2, 1 as the countdown passes each boundary.
 */
export function minutesRemaining(timer: TimerClock, nowMs: number): number {
  return Math.max(1, Math.ceil(remainingSeconds(timer, nowMs) / 60));
}

/**
 * Is the transition warning showing right now?
 *
 * True from the moment the remaining time drops to the lead time until zero.
 * A timer with no lead never warns, and a timer already over does not warn
 * either — the board has moved on to saying the time is up.
 */
export function isWarningDue(
  timer: TimerClock & { warningLeadSeconds: number | null },
  nowMs: number
): boolean {
  if (timer.warningLeadSeconds === null) return false;
  if (phaseOf(timer, nowMs) !== 'running') return false;
  return remainingSeconds(timer, nowMs) <= timer.warningLeadSeconds;
}

/* -------------------------------------------------------------------------- */
/* clock skew                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * How far the device's clock is behind the server's. Added to a device
 * timestamp, it yields server time.
 *
 * Deliberately ignores the half round-trip of the response: on a LAN it is
 * single-digit milliseconds, and the acceptance target is ±1s. Naming it here
 * so the omission is a decision rather than an oversight.
 */
export function clockOffsetMs(serverNowMs: number, clientNowMs: number): number {
  return serverNowMs - clientNowMs;
}

/** Server time, from the device clock plus the offset measured at the last read. */
export function serverNowFrom(clientNowMs: number, offsetMs: number): number {
  return clientNowMs + offsetMs;
}

/**
 * Milliseconds until the next whole second on the *server's* clock, so the
 * digits change on the second rather than 400ms into it. Always in 1..1000 —
 * a zero would spin a timeout loop.
 */
export function nextTickDelayMs(serverNowMs: number): number {
  const past = ((serverNowMs % 1000) + 1000) % 1000;
  return 1000 - past;
}
