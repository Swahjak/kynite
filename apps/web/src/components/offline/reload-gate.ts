/**
 * When a wall tablet is allowed to reload itself (docs/architecture.md §6,
 * "Long-run hygiene": the SW skips waiting, posts `RELOAD_HUB`, and "the hub
 * reloads only when idle >5 min + nightly — a deploy must never interrupt a
 * morning routine; the tablet runs for months").
 *
 * The rule is small and the stakes are not: getting it wrong means a new build
 * blanking the board mid-"shoes on". So it is a pure function over an explicit
 * clock, with a truth table, rather than a `setTimeout` somewhere in a
 * component.
 *
 * Read it as: **a pending update waits for a moment nobody is looking.**
 */

/** §6's five minutes. Below this, someone is standing at the board. */
export const IDLE_BEFORE_RELOAD_MS = 5 * 60_000;

/**
 * The nightly window, in local hours (`[start, end)`). 03:00–05:00 is after
 * the latest plausible bedtime routine and before the earliest morning one.
 */
export const NIGHTLY_WINDOW = { startHour: 3, endHour: 5 } as const;

/**
 * A ceiling on how long a pending update may be deferred.
 *
 * Without it, a tablet in a hallway that is touched every four minutes all day
 * and sits in a room whose clock never enters the nightly window (a device
 * powered off at night, resumed at 08:00) would defer forever. Two days is
 * long enough that no ordinary day trips it and short enough that a fix ships.
 */
export const MAX_DEFERRAL_MS = 2 * 86_400_000;

export type ReloadGateInput = {
  now: Date;
  /** When the service worker said a new build is waiting. `null` = nothing pending. */
  updateReadyAt: Date | null;
  /** Last touch/keypress/pointer event on this device. */
  lastInteractionAt: Date;
};

export function isNightly(now: Date, window = NIGHTLY_WINDOW): boolean {
  const hour = now.getHours();
  return hour >= window.startHour && hour < window.endHour;
}

export function idleMs(input: Pick<ReloadGateInput, 'now' | 'lastInteractionAt'>): number {
  return Math.max(0, input.now.getTime() - input.lastInteractionAt.getTime());
}

/**
 * `true` when the hub may reload *now*.
 *
 * Three ways to say yes, one hard no:
 *
 *  - nothing is pending → never (there is nothing to reload *for*);
 *  - idle longer than five minutes → yes, nobody is mid-routine;
 *  - inside the nightly window → yes, the household is asleep;
 *  - deferred for more than two days → yes regardless, so a device that never
 *    goes idle still eventually gets the fix.
 *
 * The first two are a disjunction, not a conjunction (M11: "idle >5 min **or**
 * nightly"). They are two independent descriptions of "nobody is looking",
 * and requiring both would mean a tablet that is never on at 03:00 never
 * updates at all.
 */
export function shouldReloadHub(input: ReloadGateInput): boolean {
  return reloadReason(input) !== null;
}

/**
 * Why the gate said yes — for the log line, and for the test that has to tell
 * the two admissible moments apart.
 */
export type ReloadReason = 'idle' | 'nightly' | 'deferred-too-long' | null;

export function reloadReason(input: ReloadGateInput): ReloadReason {
  if (!input.updateReadyAt) return null;
  if (input.now.getTime() - input.updateReadyAt.getTime() >= MAX_DEFERRAL_MS) {
    return 'deferred-too-long';
  }
  if (idleMs(input) >= IDLE_BEFORE_RELOAD_MS) return 'idle';
  if (isNightly(input.now)) return 'nightly';
  return null;
}

/** The message the service worker posts to its clients (§6). */
export const RELOAD_HUB_MESSAGE = 'RELOAD_HUB' as const;
