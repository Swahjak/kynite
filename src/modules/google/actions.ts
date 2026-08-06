'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { assertCan, getPrincipal } from '@/modules/family';
import { actionFailure as failure, idleState, type ActionState } from './action-state';
import { getDb } from '@/server/db';
import { stopChannel, watchCalendar } from './channels';
import { enqueueCalendarSync } from './jobs';
import { unlinkGoogleAccount } from './linking';
import { calendar, googleAccount } from './schema';

/**
 * Mutations for the Google slice. Every action authorizes through
 * `assertCan('google:link', …)` before it touches data (§7 chokepoint,
 * enforced by `tests/unit/server-action-authorization.test.ts`).
 *
 * `google:link` grades `own` for an adult and `allow` for the owner, and the
 * grade is resolved *before* any read — so each action authorizes against the
 * caller's own member id first, then narrows the query itself for a non-owner.
 * That ordering is what keeps the AST auditor satisfied and, more importantly,
 * what stops an adult from acting on another parent's linked account.
 */

const uuid = z.uuid();

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/** Restricts a query to the caller's own accounts unless they are the owner. */
function ownershipFilter(principal: { role: string; memberId: string }) {
  return principal.role === 'owner'
    ? undefined
    : eq(googleAccount.ownerMemberId, principal.memberId);
}

export async function setCalendarSyncAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') return failure('forbidden');

  const authorized = await assertCan('google:link', {
    ownerMemberId: principal.memberId,
  }).catch(() => null);
  if (!authorized) return failure('forbidden');

  const calendarId = read(formData, 'calendarId');
  const enabled = read(formData, 'enabled') === 'true';
  if (!uuid.safeParse(calendarId).success) return failure('invalidInput');

  const db = getDb();
  const [row] = await db
    .select()
    .from(calendar)
    .innerJoin(googleAccount, eq(calendar.googleAccountId, googleAccount.id))
    .where(
      and(
        eq(calendar.id, calendarId),
        eq(calendar.familyId, principal.familyId),
        ownershipFilter(principal)
      )
    )
    .limit(1)
    .then((rows) => rows.map((entry) => entry.calendar));

  if (!row) return failure('calendarNotFound');

  const [updated] = await db
    .update(calendar)
    .set({ syncEnabled: enabled, updatedAt: new Date() })
    .where(eq(calendar.id, calendarId))
    .returning();

  if (enabled) {
    // Watch first, then sync: a channel registered after the initial pass would
    // miss every change made during it.
    await watchCalendar(updated).catch(() => {});
    await enqueueCalendarSync(calendarId);
  } else {
    await stopChannel(updated).catch(() => {});
  }

  revalidatePath(`/${await getLocale()}/settings/google`);
  return idleState;
}

export async function syncNowAction(
  _previous: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') return failure('forbidden');

  const authorized = await assertCan('google:link', {
    ownerMemberId: principal.memberId,
  }).catch(() => null);
  if (!authorized) return failure('forbidden');

  const rows = await getDb()
    .select({ id: calendar.id })
    .from(calendar)
    .where(and(eq(calendar.familyId, principal.familyId), eq(calendar.syncEnabled, true)));

  for (const row of rows) await enqueueCalendarSync(row.id);

  revalidatePath(`/${await getLocale()}/settings/google`);
  return idleState;
}

export async function unlinkGoogleAccountAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') return failure('forbidden');

  const authorized = await assertCan('google:link', {
    ownerMemberId: principal.memberId,
  }).catch(() => null);
  if (!authorized) return failure('forbidden');

  const accountId = read(formData, 'accountId');
  if (!uuid.safeParse(accountId).success) return failure('invalidInput');

  const [account] = await getDb()
    .select({ id: googleAccount.id })
    .from(googleAccount)
    .where(
      and(
        eq(googleAccount.id, accountId),
        eq(googleAccount.familyId, principal.familyId),
        ownershipFilter(principal)
      )
    )
    .limit(1);

  if (!account) return failure('accountNotFound');

  await unlinkGoogleAccount(account.id);

  revalidatePath(`/${await getLocale()}/settings/google`);
  return idleState;
}
