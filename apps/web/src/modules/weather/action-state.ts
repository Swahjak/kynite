import type { ActionState } from '@/modules/family';

/**
 * The slice's own idle/failure constructors — same split, same reason, as
 * `modules/ics/action-state.ts`: the *type* is shared (one action shape across
 * the app, imported `import type` so nothing survives into the bundle), the
 * runtime values are local, because importing them from `@/modules/family`
 * would pull that barrel — and the database client with it — into every client
 * component that renders one of this slice's forms.
 */
export const idleState: ActionState = { status: 'idle' };

export const actionFailure = (error: string): ActionState => ({ status: 'error', error });

export type { ActionState };
