'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { assertCan, getPrincipal, type ActionState } from '@/modules/family';
import { SURFACE_COOKIE, type SurfaceCookieValue } from './resolve';

export const idleState: ActionState = { status: 'idle' };

const failure = (error: string): ActionState => ({ status: 'error', error });

export type { ActionState };

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const SURFACE_VALUES: readonly SurfaceCookieValue[] = ['app', 'desktop'];

/**
 * Which surface this member's browser renders as (H2a).
 *
 * Authorized by `member:self`, the same shape as
 * `updateNotificationPreferencesAction` in the notifications slice: a member
 * sets their *own* browser's rendering preference, never another member's, so
 * the cookie is the caller's alone and the form has no field for anyone else.
 * A device principal is refused by the type narrow above — a kiosk never
 * reaches `member:self`.
 */
export async function setSurfacePreferenceAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') return failure('forbidden');

  const permitted = await assertCan('member:self', { ownerMemberId: principal.memberId })
    .then(() => true)
    .catch(() => false);
  if (!permitted) return failure('forbidden');

  const raw = formData.get('surface');
  const surface = typeof raw === 'string' ? raw : '';

  if (surface === 'auto') {
    (await cookies()).delete(SURFACE_COOKIE);
  } else if (SURFACE_VALUES.includes(surface as SurfaceCookieValue)) {
    (await cookies()).set(SURFACE_COOKIE, surface, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: MAX_AGE_SECONDS,
      path: '/',
      sameSite: 'lax',
    });
  } else {
    return failure('invalidInput');
  }

  revalidatePath('/', 'layout');
  return idleState;
}
