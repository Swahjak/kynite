import type { ActionState } from '@/modules/family';

/**
 * The slice's own idle/failure constructors.
 *
 * The *type* is shared with the family slice (one action shape across the app,
 * imported `import type` so nothing survives into the bundle), but the runtime
 * values are local on purpose: importing them from `@/modules/family` would
 * pull that barrel — and with it `server-only` queries and the database
 * client — into every client component that renders a Google form.
 */
export const idleState: ActionState = { status: 'idle' };

export const actionFailure = (error: string): ActionState => ({ status: 'error', error });

export type { ActionState };
