/**
 * Shared return shapes for the rewards slice's Server Actions.
 *
 * Lives outside `actions.ts` because a `'use server'` module may only export
 * async functions. `error` is a translation key under `rewards.errors`, never
 * prose — both locales stay in `messages/`.
 */

export type ActionState = { status: 'idle' } | { status: 'error'; error: string };

export const idleState: ActionState = { status: 'idle' };

export const actionFailure = (error: string): ActionState => ({ status: 'error', error });

/**
 * What a redemption request gets back.
 *
 * `replayed` distinguishes "the write landed twice" from "the write did
 * nothing" — the same distinction `CompletionState` draws, and for the same
 * reason: both render identically to a child (the tile flips to "asked"), but
 * they are different facts, and only one of them should ever reach a log.
 *
 * There is no rejection shape for "you cannot afford this". The store never
 * offers the button for a reward that is out of reach, so the server's refusal
 * is a defence-in-depth check, not a message a child is meant to read.
 */
export type RedemptionState =
  { status: 'requested'; replayed: boolean } | { status: 'error'; error: string };

export const redemptionFailure = (error: string): RedemptionState => ({
  status: 'error',
  error,
});
