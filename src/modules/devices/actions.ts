'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import {
  DEVICE_SESSION_COOKIE,
  deviceCookieOptions,
  hashPairingCode,
  normalizePairingCode,
} from '@/lib/device-session';
import { assertCan } from '@/modules/family';
import { publish } from '@/modules/realtime';
import {
  actionFailure,
  pairDeviceFailure,
  pairingCodeFailure,
  type ActionState,
  type PairDeviceState,
  type PairingCodeState,
} from './action-state';
import { DEVICE_KINDS } from './schema';
import { cancelPairingCode, createPairingCode, redeemPairingCode, revokeDevice } from './queries';

/**
 * Mutations for the devices slice (M12, docs/architecture.md §7 "Kiosk device
 * pairing").
 *
 * Four actions and exactly one exemption. `createPairingCodeAction`,
 * `cancelPairingCodeAction` and `revokeDeviceAction` open with
 * `assertCan('device:manage')` — the §7 matrix cell granted to owners and
 * adults and to nobody else, devices included, so a paired kiosk can never
 * pair, cancel or revoke another. `pairDeviceAction` is the exemption: it is
 * the action that *establishes* a credential, so there is no principal to
 * check yet and the six digits are the authorization. It carries
 * `@public-action` and is pinned in the allowlist of
 * `tests/unit/server-action-authorization.test.ts`, alongside sign-in and
 * sign-up, which are the same class of thing.
 *
 * Self-unpair — a paired hub removing its own device — is deliberately *not*
 * here. It is `POST /api/devices/session/unpair`, a route handler, not a
 * Server Action, and it does not call `assertCan` at all: the device session
 * cookie being surrendered *is* the credential authorizing its own
 * surrender, the same way a sign-out needs no capability check on the
 * account it signs out of. Gymnastics with `device:manage` would be the
 * wrong shape here — that capability is about one principal acting on
 * *another* device, and a device un-pairing itself is not that.
 */

const trimmed = z.string().trim();

async function revalidateDevices(): Promise<void> {
  const locale = await getLocale();
  revalidatePath(`/${locale}/settings/devices`);
}

const createSchema = z.object({
  deviceName: trimmed.min(1).max(60),
  kind: z.enum(DEVICE_KINDS).default('hub'),
});

export type CreatePairingCodeInput = z.infer<typeof createSchema>;

/**
 * Generate a 6-digit pairing code with a 10-minute TTL.
 *
 * The digits come back once, in the return value, and are never stored — the
 * row holds `sha256('pairing:' + code)`. A parent who closes the dialog
 * generates a new code rather than recovering the old one, which is the same
 * bargain every other bearer secret in this codebase makes.
 */
export async function createPairingCodeAction(
  input: CreatePairingCodeInput
): Promise<PairingCodeState> {
  const principal = await assertCan('device:manage').catch(() => null);
  if (!principal) return pairingCodeFailure('forbidden');

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return pairingCodeFailure('invalidInput');

  const result = await createPairingCode({
    familyId: principal.familyId,
    deviceName: parsed.data.deviceName,
    kind: parsed.data.kind,
    createdByMemberId: principal.kind === 'member' ? principal.memberId : null,
  });

  // BLOCKING 1c: the per-family cap on live codes (reviewer finding 4,
  // cross-tenant code-space exhaustion). Fails closed — no partial code, no
  // hint at which family is at the limit.
  if (result.status === 'tooManyPending') return pairingCodeFailure('tooManyPending');

  await revalidateDevices();

  return {
    status: 'created',
    code: result.code,
    deviceName: parsed.data.deviceName,
    expiresAt: result.expiresAt.getTime(),
  };
}

const cancelPairingCodeSchema = z.object({ id: z.uuid() });

export type CancelPairingCodeInput = z.infer<typeof cancelPairingCodeSchema>;

/**
 * Cancel a pending code before it is ever typed in (settings/devices §7:
 * `device:manage`, the same cell as minting one). Deliberately owner-scoped
 * rather than exposed to the hub: a code is cancelled from the screen that
 * generated it, not from the tablet it was meant for.
 */
export async function cancelPairingCodeAction(input: CancelPairingCodeInput): Promise<ActionState> {
  const principal = await assertCan('device:manage').catch(() => null);
  if (!principal) return actionFailure('forbidden');

  const parsed = cancelPairingCodeSchema.safeParse(input);
  if (!parsed.success) return actionFailure('invalidInput');

  const cancelled = await cancelPairingCode(principal.familyId, parsed.data.id);
  if (!cancelled) return actionFailure('pairingCodeNotFound');

  await revalidateDevices();

  return { status: 'idle' };
}

const pairSchema = z.object({ code: trimmed.min(1).max(20) });

export type PairDeviceInput = z.infer<typeof pairSchema>;

/**
 * Exchange a pairing code for a device session (`/hub/pair`).
 *
 * @public-action — there is no principal to authorize: this action *is* the
 * authentication. The code is the credential, and everything that makes it one
 * (10-minute TTL, single use, one family) is enforced by the claiming UPDATE in
 * `redeemPairingCode`, not here. Brute force is bounded by a per-client
 * failure counter; the fingerprint is a hash of the forwarded address and user
 * agent, so no raw address is written anywhere.
 *
 * The raw token never leaves this function except into the cookie. It is not
 * returned, not logged, and not put in the revalidated payload — a Server
 * Action's return value travels in the RSC stream, which is not a place for a
 * bearer secret.
 */
export async function pairDeviceAction(input: PairDeviceInput): Promise<PairDeviceState> {
  const parsed = pairSchema.safeParse(input);
  if (!parsed.success) return pairDeviceFailure('invalidCode');

  const code = normalizePairingCode(parsed.data.code);
  if (!code) return pairDeviceFailure('invalidCode');

  const requestHeaders = await headers();
  const clientHash = createHash('sha256')
    .update(
      [
        requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown',
        requestHeaders.get('user-agent') ?? 'unknown',
      ].join('|')
    )
    .digest('hex');

  const outcome = await redeemPairingCode({ codeHash: hashPairingCode(code), clientHash });

  if (outcome.status !== 'paired') return pairDeviceFailure(outcome.status);

  (await cookies()).set(DEVICE_SESSION_COOKIE, outcome.result.token, deviceCookieOptions());

  return { status: 'paired', deviceName: outcome.result.deviceName };
}

const revokeSchema = z.object({ deviceId: z.uuid() });

export type RevokeDeviceInput = z.infer<typeof revokeSchema>;

/**
 * Revoke a paired device.
 *
 * The publish is the second half of the criterion "revoking a device drops the
 * hub to the pair screen on the next request **or SSE tick**". The next-request
 * half is free — `getPrincipal()` joins `device.revoked_at is null`, so the
 * very next page render has no principal. The tick half needs the family
 * channel: the wall tablet is ambient and may not make another request for
 * hours, and a revoked kitchen display that keeps showing the schedule until
 * somebody touches it is not revoked in any sense a parent would recognise.
 */
export async function revokeDeviceAction(input: RevokeDeviceInput): Promise<ActionState> {
  const principal = await assertCan('device:manage').catch(() => null);
  if (!principal) return actionFailure('forbidden');

  const parsed = revokeSchema.safeParse(input);
  if (!parsed.success) return actionFailure('invalidInput');

  const revoked = await revokeDevice(principal.familyId, parsed.data.deviceId);
  if (!revoked) return actionFailure('deviceNotFound');

  await publish({
    familyId: principal.familyId,
    type: 'device.revoked',
    entity: { id: parsed.data.deviceId },
    actor: {
      ...(principal.kind === 'member' ? { memberId: principal.memberId } : {}),
      source: 'mobile',
    },
  });

  await revalidateDevices();

  return { status: 'idle' };
}
