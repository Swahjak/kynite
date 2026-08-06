'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { redirect } from '@/i18n/navigation';
import { getAuth } from '@/server/auth';
import { getDb } from '@/server/db';
import { user } from '@/server/db/auth-schema';
import { actionFailure as failure, idleState, type ActionState } from './action-state';
import { assertCan } from './principal';
import {
  MEMBER_COLORS,
  MEMBER_ROLES,
  REWARD_HORIZONS,
  family,
  member,
  type MemberRole,
} from './schema';
import { MEMBER_AVATARS, avatarUrlFor } from './ui/tokens';

/**
 * Mutations for the family slice. Every action authorizes through
 * `assertCan()` → `can()` (docs/architecture.md §7) before it touches data.
 *
 * The three account-lifecycle actions are tagged `@public-action`: they run for
 * a caller who has no principal *yet* (or is discarding one). That exemption is
 * pinned by `tests/unit/server-action-authorization.test.ts`, which fails the
 * moment an unlisted action skips authorization.
 */

const trimmed = z.string().trim();

/** The only avatarUrl values a member may carry — the built-in avatar set. */
const AVATAR_URLS = MEMBER_AVATARS.map(avatarUrlFor) as [string, ...string[]];

const signUpSchema = z.object({
  name: trimmed.min(1).max(80),
  familyName: trimmed.min(1).max(80),
  email: z.email(),
  password: z.string().min(8).max(128),
});

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});

const memberSchema = z.object({
  displayName: trimmed.min(1).max(80),
  role: z.enum(MEMBER_ROLES),
  color: z.enum(MEMBER_COLORS),
  rewardHorizon: z.enum(REWARD_HORIZONS),
  // Free text was an unvalidated img-src injection risk; only the built-in
  // avatar set (public/avatars) may be stored.
  avatarUrl: z.enum(AVATAR_URLS).optional().or(z.literal('')),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
});

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function memberInput(formData: FormData) {
  return memberSchema.safeParse({
    displayName: read(formData, 'displayName'),
    role: read(formData, 'role'),
    color: read(formData, 'color'),
    rewardHorizon: read(formData, 'rewardHorizon'),
    avatarUrl: read(formData, 'avatarUrl'),
    birthDate: read(formData, 'birthDate'),
  });
}

/**
 * First run: create the account, then the household, then the session — in that
 * order, so the session cookie is stamped with `activeFamilyId` + `memberId`
 * the moment it is issued (see `src/server/auth.ts`).
 *
 * @public-action Sign-up has no principal to authorize; it *creates* one.
 */
export async function signUpAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    name: read(formData, 'name'),
    familyName: read(formData, 'familyName'),
    email: read(formData, 'email'),
    password: read(formData, 'password'),
  });

  if (!parsed.success) return failure('invalidInput');

  const { name, familyName, email, password } = parsed.data;
  const auth = getAuth();
  const requestHeaders = await headers();

  let signedUp: Awaited<ReturnType<typeof auth.api.signUpEmail>>;
  try {
    signedUp = await auth.api.signUpEmail({
      body: { name, email, password },
      headers: requestHeaders,
    });
  } catch (error) {
    return failure(signUpErrorKey(error));
  }

  try {
    // Family + owner member in one transaction: a household is never half-made.
    await getDb().transaction(async (tx) => {
      const [created] = await tx.insert(family).values({ name: familyName }).returning();

      await tx.insert(member).values({
        familyId: created.id,
        userId: signedUp.user.id,
        displayName: name,
        role: 'owner',
        color: 'blue',
        rewardHorizon: 'savings',
        sortOrder: 0,
      });
    });
  } catch (error) {
    // The auth user now exists with no household: unfixed, that's an orphan
    // account — a working login with nowhere to land (infinite redirect
    // bounce, since every product page requires an active family). Better-auth
    // has already committed the user row by this point, so compensate here by
    // deleting it directly; `onDelete: 'cascade'` takes its session/account
    // rows with it. Best-effort: if the delete itself fails, the orphan is
    // surfaced via the generic failure rather than silently swallowed.
    await getDb()
      .delete(user)
      .where(eq(user.id, signedUp.user.id))
      .catch(() => {});
    return failure(signUpErrorKey(error));
  }

  try {
    await auth.api.signInEmail({ body: { email, password }, headers: requestHeaders });
  } catch (error) {
    // Family + member exist at this point; only the auto-login failed. Not an
    // orphan — the account is usable via the sign-in page — so no compensating
    // delete here.
    return failure(signUpErrorKey(error));
  }

  redirect({ href: '/family', locale: await getLocale() });
  // `redirect()` throws — unreachable, but the signature must stay total.
  return idleState;
}

function signUpErrorKey(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  return /exist|taken|unique/i.test(message) ? 'emailTaken' : 'signUpFailed';
}

/** @public-action Sign-in has no principal to authorize; it establishes one. */
export async function signInAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = signInSchema.safeParse({
    email: read(formData, 'email'),
    password: read(formData, 'password'),
  });

  if (!parsed.success) return failure('invalidCredentials');

  try {
    await getAuth().api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: await headers(),
    });
  } catch {
    return failure('invalidCredentials');
  }

  redirect({ href: '/family', locale: await getLocale() });
  // `redirect()` throws — unreachable, but the signature must stay total.
  return idleState;
}

/** @public-action Signing out discards the principal; nothing to permit. */
export async function signOutAction(): Promise<void> {
  await getAuth().api.signOut({ headers: await headers() });
  redirect({ href: '/sign-in', locale: await getLocale() });
}

export async function createMemberAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('member:manage').catch(() => null);
  if (!principal) return failure('forbidden');

  const parsed = memberInput(formData);
  if (!parsed.success) return failure('invalidInput');

  const input = parsed.data;
  if (input.role === 'owner') return failure('singleOwner');

  const db = getDb();
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${member.sortOrder}), -1) + 1` })
    .from(member)
    .where(eq(member.familyId, principal.familyId));

  // Children never get a login: `userId` stays null (docs/architecture.md §3).
  await db.insert(member).values({
    familyId: principal.familyId,
    displayName: input.displayName,
    role: input.role as MemberRole,
    color: input.color,
    rewardHorizon: input.rewardHorizon,
    avatarUrl: input.avatarUrl || null,
    birthDate: input.birthDate || null,
    sortOrder: Number(next),
  });

  revalidatePath(`/${await getLocale()}/family`);
  return idleState;
}

export async function updateMemberAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const memberId = read(formData, 'memberId');
  const principal = await assertCan('member:manage', { memberId }).catch(() => null);
  if (!principal) return failure('forbidden');

  const parsed = memberInput(formData);
  if (!parsed.success || !z.uuid().safeParse(memberId).success) return failure('invalidInput');

  const input = parsed.data;
  const db = getDb();

  const [existing] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.familyId, principal.familyId)))
    .limit(1);

  if (!existing) return failure('memberNotFound');
  // Exactly one owner per family: the role of the owner row is immutable here.
  if (existing.role === 'owner' && input.role !== 'owner') return failure('singleOwner');
  if (existing.role !== 'owner' && input.role === 'owner') return failure('singleOwner');

  await db
    .update(member)
    .set({
      displayName: input.displayName,
      role: input.role as MemberRole,
      color: input.color,
      rewardHorizon: input.rewardHorizon,
      avatarUrl: input.avatarUrl || null,
      birthDate: input.birthDate || null,
      updatedAt: new Date(),
    })
    .where(and(eq(member.id, memberId), eq(member.familyId, principal.familyId)));

  revalidatePath(`/${await getLocale()}/family`);
  return idleState;
}

export async function deleteMemberAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const memberId = read(formData, 'memberId');
  const principal = await assertCan('member:manage', { memberId }).catch(() => null);
  if (!principal) return failure('forbidden');

  if (!z.uuid().safeParse(memberId).success) return failure('invalidInput');

  const db = getDb();
  const [existing] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.familyId, principal.familyId)))
    .limit(1);

  if (!existing) return failure('memberNotFound');
  if (existing.role === 'owner') return failure('cannotRemoveOwner');

  await db
    .delete(member)
    .where(and(eq(member.id, memberId), eq(member.familyId, principal.familyId)));

  revalidatePath(`/${await getLocale()}/family`);
  return idleState;
}
