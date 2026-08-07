/**
 * Shared return shapes for the devices slice's Server Actions.
 *
 * Lives outside `actions.ts` because a `'use server'` module may only export
 * async functions. `error` is a translation key under `devices.errors`, never
 * prose — both locales stay in `messages/`.
 */

export type ActionState = { status: 'idle' } | { status: 'error'; error: string };

export const idleState: ActionState = { status: 'idle' };

export const actionFailure = (error: string): ActionState => ({ status: 'error', error });

/**
 * A freshly minted pairing code. The digits are returned once, to one screen,
 * and are never readable again — the row holds only their hash.
 */
export type PairingCodeState =
  | { status: 'idle' }
  | { status: 'created'; code: string; deviceName: string; expiresAt: number }
  | { status: 'error'; error: string };

export const pairingCodeIdle: PairingCodeState = { status: 'idle' };

export const pairingCodeFailure = (error: string): PairingCodeState => ({
  status: 'error',
  error,
});

/**
 * The hub's side of the exchange. `paired` carries nothing but the device name:
 * the credential went into an httpOnly cookie, and a token in a Server Action's
 * return value would be a token in the RSC payload.
 */
export type PairDeviceState =
  | { status: 'idle' }
  | { status: 'paired'; deviceName: string }
  | { status: 'error'; error: string };

export const pairDeviceIdle: PairDeviceState = { status: 'idle' };

export const pairDeviceFailure = (error: string): PairDeviceState => ({
  status: 'error',
  error,
});
