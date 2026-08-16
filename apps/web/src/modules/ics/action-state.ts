import type { ActionState } from '@/modules/family';

/**
 * The slice's own idle/failure constructors — same split, same reason, as
 * `modules/google/action-state.ts`: the *type* is shared (one action shape
 * across the app, imported `import type` so nothing survives into the bundle),
 * the runtime values are local, because importing them from `@/modules/family`
 * would pull that barrel — and the database client with it — into every client
 * component that renders one of this slice's forms.
 */
export const idleState: ActionState = { status: 'idle' };

export const actionFailure = (error: string): ActionState => ({ status: 'error', error });

/**
 * Adding a feed has a third outcome the shared `ActionState` has no room for:
 * **it worked, and you should still read this**.
 *
 * A dead feed does not fail — the abandoned schoolvakanties mirrors answer 200
 * with a valid, event-free VCALENDAR — so "no error" and "this is fine" are not
 * the same statement here. `warnings` carries translation keys under
 * `ics.add.warnings`, exactly as `error` carries them under `ics.errors`, and
 * an empty array is the ordinary success. Local to this slice for the reason
 * `CreateInviteState` is local to `modules/family`: one action needs a wider
 * shape, and widening the shared one would make every other action's caller
 * handle a state it can never return.
 */
export type AddSubscriptionState = ActionState | { status: 'added'; warnings: readonly string[] };

export const addedState = (warnings: readonly string[]): AddSubscriptionState => ({
  status: 'added',
  warnings,
});

export type { ActionState };
