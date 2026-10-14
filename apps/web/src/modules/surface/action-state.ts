/**
 * Shared return shape for the surface slice's Server Action (H2a).
 *
 * Lives outside `actions.ts` because a `'use server'` module may only export
 * async functions — values and types must come from a plain module. `error` is
 * a translation key under `settings.surface.errors`, never prose.
 */
export type ActionState = { status: 'idle' } | { status: 'error'; error: string };

export const idleState: ActionState = { status: 'idle' };
