/**
 * Shared return shapes for the timers slice's Server Actions.
 *
 * Lives outside `actions.ts` because a `'use server'` module may only export
 * async functions. `error` is a translation key under `timers.errors`, never
 * prose — both locales stay in `messages/`.
 */

export type ActionState = { status: 'idle' } | { status: 'error'; error: string };

export const idleState: ActionState = { status: 'idle' };

export const actionFailure = (error: string): ActionState => ({ status: 'error', error });

/**
 * What starting a timer gets back. `replayed` distinguishes "the same tap
 * arrived twice" from "a second timer started" — both leave exactly one
 * countdown on the wall, but they are different facts.
 */
export type StartTimerState =
  { status: 'started'; timerId: string; replayed: boolean } | { status: 'error'; error: string };

export const startFailure = (error: string): StartTimerState => ({ status: 'error', error });

export type StopTimerState = { status: 'stopped' } | { status: 'error'; error: string };

export const stopFailure = (error: string): StopTimerState => ({ status: 'error', error });

/**
 * What extending a timer gets back (M18). The new total duration rides along
 * so a caller can reconcile without a refetch — every countdown in this slice
 * is derived from `startedAt + durationSeconds`, and this is the only value
 * that changes.
 *
 * `atMaximum` is a *successful no-op*: the timer is already at
 * `MAX_DURATION_SECONDS`, so nothing moved and nothing was broadcast. It is not
 * an error — the parent did nothing wrong — but reporting it as `extended`
 * would be a lie a caller could act on, so it is its own status.
 */
export type ExtendTimerState =
  | { status: 'extended'; durationSeconds: number }
  | { status: 'atMaximum'; durationSeconds: number }
  | { status: 'error'; error: string };

export const extendFailure = (error: string): ExtendTimerState => ({ status: 'error', error });
