'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { assertCan, getPrincipal } from '@/modules/family';
import { actionFailure as failure, idleState, type ActionState } from './action-state';
import { upsertNotificationPreferences } from './queries';

/**
 * Mutations for the notifications slice (M16).
 *
 * One action, and it writes exactly one row: the caller's own preferences.
 */

const preferencesSchema = z.object({
  routineReminders: z.boolean(),
  redemptionRequests: z.boolean(),
  completionUpdates: z.boolean(),
});

function checked(formData: FormData, key: string): boolean {
  // An unchecked checkbox submits *nothing*, so absence is `false`. NB-8: mere
  // *presence* is not enough — a scripted client posting `key=false` is
  // present-but-off, and `!== null` would have read that as checked. Reading
  // the value itself keeps the native form's `'on'` working and still accepts
  // `'true'` from a scripted client, without accepting anything else as truthy.
  const value = formData.get(key);
  return value === 'on' || value === 'true';
}

/**
 * Which notifications this member wants (M16).
 *
 * Authorized by `member:self`, which grades `own` for every account-backed
 * role — so an adult second parent can set their own preferences without
 * holding owner-only `member:manage`, and no principal can ever write another
 * person's row: the `memberId` is taken from the principal and the form has no
 * field for it. That is the same shape (and the same reason) as
 * `chooseProfileAction` in the family slice.
 *
 * A kiosk is refused by the matrix rather than by a check here: `member:self`
 * is `deny` for a device, which is §7's "never settings" applied to the one
 * settings write a wall tablet might otherwise look entitled to.
 */
export async function updateNotificationPreferencesAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') return failure('forbidden');

  const permitted = await assertCan('member:self', { ownerMemberId: principal.memberId })
    .then(() => true)
    .catch(() => false);
  if (!permitted) return failure('forbidden');

  const parsed = preferencesSchema.safeParse({
    routineReminders: checked(formData, 'routineReminders'),
    redemptionRequests: checked(formData, 'redemptionRequests'),
    completionUpdates: checked(formData, 'completionUpdates'),
  });
  if (!parsed.success) return failure('invalidInput');

  await upsertNotificationPreferences({
    familyId: principal.familyId,
    memberId: principal.memberId,
    preferences: parsed.data,
  });

  const locale = await getLocale();
  revalidatePath(`/${locale}/settings`);
  revalidatePath(`/${locale}/settings/notifications`);
  return idleState;
}
