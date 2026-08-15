'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { env } from '@/server/env';
import { shareUrlFor } from '@/lib/share-token';
import { assertCan } from '@/modules/family';
import {
  actionFailure,
  createShareLinkFailure,
  type ActionState,
  type CreateShareLinkState,
} from './action-state';
import { SHARE_SURFACES, normalizeScope } from './domain/scope';
import { createShareLink, revokeShareLink } from './queries';
import { SHARE_ROLES } from './schema';

/**
 * Mutations for the sharing slice (M13, docs/architecture.md §7 "Caregiver
 * share links").
 *
 * Two actions, no exemptions. Both open with `assertCan('share:manage')` — the
 * §7 cell granted to owners and adults and to nobody else, notably not to a
 * device and not to a share principal, so a caregiver link can never mint a
 * second one or revoke the link that would take its own access away.
 *
 * Note what is *not* an action: resolving a token. That is a read on a public
 * URL with no principal behind it, and it lives in `./resolve.ts` where the
 * `(share)` tree can reach it without reaching this file.
 */

const trimmed = z.string().trim();

/** How far out a link may be dated. A year is already a long time to be lent a house key. */
const MAX_EXPIRY_DAYS = 365;

async function revalidateSharing(): Promise<void> {
  const locale = await getLocale();
  revalidatePath(`/${locale}/settings/sharing`);
}

const createSchema = z.object({
  role: z.enum(SHARE_ROLES),
  label: trimmed.max(60).optional(),
  memberIds: z.array(z.uuid()).max(50).optional(),
  calendarIds: z.array(z.uuid()).max(50).optional(),
  surfaces: z.array(z.enum(SHARE_SURFACES)).max(SHARE_SURFACES.length).optional(),
  /**
   * Days from now, or `null` for a link that does not expire.
   *
   * Deliberately a *duration*, not a date: a date arriving from a client is a
   * date in the client's clock, and a link that expires "yesterday" because a
   * tablet's timezone is wrong is a support ticket. The server does the
   * arithmetic against its own now.
   */
  expiresInDays: z.number().int().min(1).max(MAX_EXPIRY_DAYS).nullable().optional(),
});

export type CreateShareLinkInput = z.infer<typeof createSchema>;

/**
 * Mint a caregiver link, and hand back the raw token exactly once.
 *
 * The token is generated, hashed and stored in `createShareLink`; what comes
 * back here is the raw value and the URL built from it. It is returned, never
 * logged and never revalidated into a cached payload — a Server Action's return
 * value travels in the RSC stream for this one response, which is where a
 * one-time secret belongs and is the same route `pairDeviceAction` deliberately
 * refuses to use for the device token (that one goes straight into an httpOnly
 * cookie instead, because it does not need to be read by a human).
 */
export async function createShareLinkAction(
  input: CreateShareLinkInput
): Promise<CreateShareLinkState> {
  const principal = await assertCan('share:manage').catch(() => null);
  if (!principal) return createShareLinkFailure('forbidden');

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return createShareLinkFailure('invalidInput');

  const { role, label, expiresInDays } = parsed.data;

  const expiresAt =
    expiresInDays == null ? null : new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const { link, token } = await createShareLink({
    familyId: principal.familyId,
    role,
    scope: normalizeScope({
      memberIds: parsed.data.memberIds,
      calendarIds: parsed.data.calendarIds,
      surfaces: parsed.data.surfaces,
    }),
    label: label && label.length > 0 ? label : null,
    expiresAt,
  });

  const locale = await getLocale();
  await revalidateSharing();

  return {
    status: 'created',
    token,
    // `BETTER_AUTH_URL` is already this install's canonical origin (it is what
    // Google's webhook address is built from, §5), so the link a parent copies
    // is the same origin the app is reachable on rather than whatever host
    // header this particular request happened to carry.
    url: shareUrlFor(env.BETTER_AUTH_URL, locale, token),
    role: link.role,
    expiresAt: link.expiresAt ? link.expiresAt.getTime() : null,
  };
}

const revokeSchema = z.object({ id: z.uuid() });

export type RevokeShareLinkInput = z.infer<typeof revokeSchema>;

/**
 * Take a link away.
 *
 * Revocation is immediate and needs no invalidation anywhere else: the
 * resolver reads `revokedAt` on every request, so the next page load — and the
 * next contributor tick — fails closed. There is no cached decision and no
 * session row to delete, which is the compensating upside of a credential that
 * never established one.
 */
export async function revokeShareLinkAction(input: RevokeShareLinkInput): Promise<ActionState> {
  const principal = await assertCan('share:manage').catch(() => null);
  if (!principal) return actionFailure('forbidden');

  const parsed = revokeSchema.safeParse(input);
  if (!parsed.success) return actionFailure('invalidInput');

  const revoked = await revokeShareLink(principal.familyId, parsed.data.id);
  if (!revoked) return actionFailure('shareLinkNotFound');

  await revalidateSharing();

  return { status: 'idle' };
}
