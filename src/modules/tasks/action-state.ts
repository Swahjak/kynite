/**
 * Shared return shapes for the tasks slice's Server Actions.
 *
 * Lives outside `actions.ts` because a `'use server'` module may only export
 * async functions. `error` is a translation key under `today.tasks.errors`, never
 * prose — both locales stay in `messages/`.
 */

export type ActionState =
  { status: 'idle' } | { status: 'saved'; taskId: string } | { status: 'error'; error: string };

export const idleState: ActionState = { status: 'idle' };

export const actionFailure = (error: string): ActionState => ({ status: 'error', error });
