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

/**
 * What minting a second-parent invite gets back (M14).
 *
 * `url` embeds the raw 32-byte token and this is the only place it exists
 * outside the invitee's browser: nothing stores it, no second call retrieves
 * it, and an owner who loses the link revokes and mints another. Same bargain
 * as the caregiver share link and the six-digit pairing code before it — the
 * value travels in the RSC stream for exactly one response.
 */
export type CreateInviteState =
  | { status: 'idle' }
  | { status: 'created'; url: string; email: string; expiresAt: number }
  | { status: 'error'; error: string };

export const createInviteIdle: CreateInviteState = { status: 'idle' };

export const createInviteFailure = (error: string): CreateInviteState => ({
  status: 'error',
  error,
});
