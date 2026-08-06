/**
 * Shared return shape for the slice's Server Actions.
 *
 * Lives outside `actions.ts` because a `'use server'` module may only export
 * async functions — values and types must come from a plain module.
 *
 * `error` is a translation key under `family.errors` / `auth.errors`: actions
 * never return prose, so both locales stay in `messages/`.
 */
export type ActionState = { status: 'idle' } | { status: 'error'; error: string };

export const idleState: ActionState = { status: 'idle' };

export const actionFailure = (error: string): ActionState => ({ status: 'error', error });
