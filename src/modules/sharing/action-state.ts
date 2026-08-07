/**
 * Shared return shapes for the sharing slice's Server Actions.
 *
 * Lives outside `actions.ts` because a `'use server'` module may only export
 * async functions. `error` is a translation key under `sharing.errors`, never
 * prose — both locales stay in `messages/`.
 */

export type ActionState = { status: 'idle' } | { status: 'error'; error: string };

export const idleState: ActionState = { status: 'idle' };

export const actionFailure = (error: string): ActionState => ({ status: 'error', error });

/**
 * What minting a link gets back.
 *
 * `token` is the raw 32-byte secret and this is the **only** place it ever
 * exists outside the caregiver's URL bar. It travels in the RSC stream to the
 * component that shows it and the QR that encodes it, and is then gone: no
 * database column holds it, no second call can retrieve it, and a parent who
 * closes the dialog mints a new link rather than recovering the old one. That
 * is the same bargain `pairDeviceAction` makes with its six digits (M12), and
 * it is what makes "the raw value is unrecoverable after creation" a property
 * of the system rather than a promise.
 */
export type CreateShareLinkState =
  | { status: 'idle' }
  | { status: 'created'; token: string; url: string; role: string; expiresAt: number | null }
  | { status: 'error'; error: string };

export const createShareLinkIdle: CreateShareLinkState = { status: 'idle' };

export const createShareLinkFailure = (error: string): CreateShareLinkState => ({
  status: 'error',
  error,
});
