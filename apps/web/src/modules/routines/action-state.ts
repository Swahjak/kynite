/**
 * Shared return shapes for the routines slice's Server Actions.
 *
 * Lives outside `actions.ts` because a `'use server'` module may only export
 * async functions. `error` is a translation key under `routines.errors`, never
 * prose — both locales stay in `messages/`.
 */

export type ActionState = { status: 'idle' } | { status: 'error'; error: string };

export const idleState: ActionState = { status: 'idle' };

export const actionFailure = (error: string): ActionState => ({ status: 'error', error });

/**
 * What a completion tap gets back.
 *
 * `stars` is 0 for a graduated routine *and* for a replay — the UI never
 * animates a second star for the same completion, and never shows a negative
 * or "already done" correction either. `replayed` exists so a client can tell
 * "the write landed twice" from "the write awarded nothing", which are
 * different facts even though both render identically.
 */
export type CompletionState =
  | { status: 'done'; stars: number; replayed: boolean }
  /** The completion was taken back. `memberId` is whose board has to refresh. */
  | { status: 'undone'; memberId: string }
  | { status: 'error'; error: string };

export const completionFailure = (error: string): CompletionState => ({ status: 'error', error });
