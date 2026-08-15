/**
 * Shared return shape for the notifications slice's Server Actions (M16).
 *
 * Lives outside `actions.ts` because a `'use server'` module may only export
 * async functions — values and types must come from a plain module. `error` is
 * a translation key under `notifications.errors`, never prose.
 */
export type ActionState = { status: 'idle' } | { status: 'error'; error: string };

export const idleState: ActionState = { status: 'idle' };

export const actionFailure = (error: string): ActionState => ({ status: 'error', error });
