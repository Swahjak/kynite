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
