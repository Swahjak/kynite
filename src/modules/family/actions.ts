'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { locales } from '@/i18n/routing';
import { redirect } from '@/i18n/navigation';
import { getAuth } from '@/server/auth';
import { getDb } from '@/server/db';
import { user } from '@/server/db/auth-schema';
import { env } from '@/server/env';
import { hashInviteToken, inviteUrlFor } from '@/lib/invite-token';
import { publish } from '@/modules/realtime';
import {
  actionFailure as failure,
  createInviteFailure,
  idleState,
  type ActionState,
  type CreateInviteState,
} from './action-state';
import { inviteStateOf } from './domain/invite';
import { claimInvite, mintInvite, resolveInvite, revokeInvite } from './invites';
import { assertCan, getPrincipal } from './principal';
import {
  HUB_VIEWS,
  MEMBER_COLORS,
  MEMBER_ROLES,
  REWARD_HORIZONS,
  family,
  member,
  memberInvite,
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

/* ---------------------------------------------------------------------------
 * Household settings (milestone M16)
 * ------------------------------------------------------------------------ */

/**
 * A timezone is valid iff the platform's own ICU database knows it.
 *
 * Not an enum: the IANA list is ~600 entries, it changes with the tzdata
 * release the runtime ships, and pinning a copy of it in this file would mean
 * a family in a newly-split zone cannot select their own clock until we
 * redeploy. `Intl` is the same database every `format.dateTime()` in the app
 * resolves against, so "valid" here means exactly "renders correctly there".
 */
function isKnownTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const familySettingsSchema = z.object({
  name: trimmed.min(1).max(80),
  locale: z.enum(locales),
  timezone: trimmed.min(1).max(64).refine(isKnownTimeZone),
  /** ISO-8601 weekday numbers; the UI offers Monday and Sunday. */
  weekStartsOn: z.coerce.number().int().min(1).max(7),
});

/**
 * The household's own identity: name, language, clock, week start (M16).
 *
 * Owner-only through `family:manage` — see that capability's note in
 * `authorize.ts` for why an adult second parent may run the household without
 * being able to redefine it.
 *
 * Two of these four fields are read by *every* surface on the next request and
 * neither needs a re-login, which is the acceptance criterion:
 *
 *  - **timezone** is resolved per request in `(app)/layout.tsx` and
 *    `(hub)/layout.tsx` from the family row (M15), so a changed zone reaches
 *    every `useFormatter()` below them on the next render.
 *  - **locale** is the *household's* language: it drives the hub and push copy
 *    (`notifications/copy.ts` already reads it per family). It deliberately
 *    does **not** move the parent's own URL: `/nl/...` and `/en/...` are the
 *    per-person surface, two parents may read the app in different languages,
 *    and yanking the URL out from under the one who is typing would be a
 *    setting with a side effect nobody asked for. The wall display has no
 *    person to have a preference, so it follows the household — see
 *    `requireHubDevice`, which sends a hub on the wrong locale prefix to the
 *    family's.
 *
 * The realtime event is what closes "without re-login" for the wall: a kiosk
 * that nobody touches has no reason to re-render otherwise.
 */
export async function updateFamilyAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('family:manage').catch(() => null);
  // `family:manage` is `deny` for every non-member column, so this narrowing
  // can only ever be the compiler catching up with the matrix.
  if (!principal || principal.kind !== 'member') return failure('forbidden');

  const parsed = familySettingsSchema.safeParse({
    name: read(formData, 'name'),
    locale: read(formData, 'locale'),
    timezone: read(formData, 'timezone'),
    weekStartsOn: read(formData, 'weekStartsOn'),
  });
  if (!parsed.success) return failure('invalidInput');

  const input = parsed.data;

  await getDb().transaction(async (tx) => {
    await tx
      .update(family)
      .set({
        name: input.name,
        locale: input.locale,
        timezone: input.timezone,
        weekStartsOn: input.weekStartsOn,
        updatedAt: new Date(),
      })
      .where(eq(family.id, principal.familyId));

    await publish(
      {
        familyId: principal.familyId,
        type: 'settings.updated',
        entity: { id: principal.familyId },
        actor: { memberId: principal.memberId, source: 'mobile' },
        patch: { locale: input.locale, timezone: input.timezone },
      },
      tx
    );
  });

  await revalidateSettings();
  return idleState;
}

const hubDisplaySchema = z.object({ hubDefaultView: z.enum(HUB_VIEWS) });

/**
 * The hub's default board (PRD FR28, M16).
 *
 * `display:manage`, not `family:manage`: FR28 says *parents* configure the hub,
 * plural, and how the wall looks is the half of settings that changes nothing
 * about who the household is.
 *
 * Family-level rather than per-device on purpose. The criterion is "takes
 * effect on the hub **without re-pairing**", and the cheapest way to guarantee
 * that is for the tablet to store no preference at all: it renders whatever
 * the family row says, every time.
 */
export async function setHubDisplayAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('display:manage').catch(() => null);
  if (!principal || principal.kind !== 'member') return failure('forbidden');

  const parsed = hubDisplaySchema.safeParse({ hubDefaultView: read(formData, 'hubDefaultView') });
  if (!parsed.success) return failure('invalidInput');

  await getDb().transaction(async (tx) => {
    await tx
      .update(family)
      .set({ hubDefaultView: parsed.data.hubDefaultView, updatedAt: new Date() })
      .where(eq(family.id, principal.familyId));

    await publish(
      {
        familyId: principal.familyId,
        type: 'settings.updated',
        entity: { id: principal.familyId },
        actor: { memberId: principal.memberId, source: 'mobile' },
        patch: { hubDefaultView: parsed.data.hubDefaultView },
      },
      tx
    );
  });

  await revalidateSettings();
  return idleState;
}

/**
 * Delete the household, everything in it, and the caller's way back in (M16).
 *
 * Owner-only, and confirmed by typing the household's name — not a checkbox.
 * Every row in this database hangs off `family.id` with `onDelete: 'cascade'`,
 * so this single statement takes the members, the events, the routines, the
 * star ledger, the devices and the share links with it. There is no undo and
 * no soft-delete tombstone to restore from, which is exactly why the
 * confirmation is a thing a person has to read something to produce.
 *
 * The auth `user` rows survive deliberately: a login with no household lands
 * on sign-up and can start a new one, whereas deleting the account would strand
 * anyone who shared that email with another family (the divorced-parent
 * persona in §3 is a real column in this schema, not a hypothetical).
 */
export async function deleteFamilyAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('family:manage').catch(() => null);
  if (!principal) return failure('forbidden');

  const confirmation = read(formData, 'confirmName').trim();
  if (!confirmation) return failure('invalidInput');

  const db = getDb();
  const [existing] = await db
    .select({ name: family.name })
    .from(family)
    .where(eq(family.id, principal.familyId))
    .limit(1);

  if (!existing) return failure('familyNotFound');
  // Compared case-insensitively: the point of the gate is deliberateness, not
  // typing accuracy, and a household called "De Jansens" should not be
  // undeletable because somebody's phone capitalised it.
  if (confirmation.toLocaleLowerCase() !== existing.name.trim().toLocaleLowerCase()) {
    return failure('confirmationMismatch');
  }

  // No realtime event: the family channel is about to have no listeners left
  // that are still authorized, and every hub session for it dies with the
  // cascade — a paired tablet's next request finds no device row and drops to
  // the pair screen on its own (`requireHubDevice`).
  await db.delete(family).where(eq(family.id, principal.familyId));

  await getAuth()
    .api.signOut({ headers: await headers() })
    .catch(() => {});

  redirect({ href: '/sign-in', locale: await getLocale() });
  // `redirect()` throws — unreachable, but the signature must stay total.
  return idleState;
}

/** Every parent-app surface that renders a household setting. */
async function revalidateSettings(): Promise<void> {
  const locale = await getLocale();
  revalidatePath(`/${locale}/settings`);
  revalidatePath(`/${locale}/family`);
}

/* ---------------------------------------------------------------------------
 * Second-parent invites (PRD FR26, milestone M14)
 * ------------------------------------------------------------------------ */

const createInviteSchema = z.object({
  memberId: z.uuid(),
  email: z.email().max(254),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;

/**
 * Mint an invite link for one unclaimed adult member.
 *
 * Owner-only: `member:manage` is the §7 cell that is `allow` for the owner and
 * `deny` everywhere else, which is exactly right for a link that hands out a
 * login. Note what the input does *not* contain: a role, a display name, a
 * family id. It is a pointer to a member row the owner already created plus the
 * address to create the account under, and `mintInvite` re-derives everything
 * else from the row inside a transaction. There is no field here that could be
 * bent into arriving as an owner.
 */
/**
 * True only for the *specific* partial unique index that `mintInvite`'s
 * transaction is expected to hit — a second live invite for the same member
 * (`member_invite_live_member_unique` on `member.schema.ts`).
 *
 * Narrowed by Postgres error code (`23505`, unique_violation) *and* by
 * constraint name, not by a blanket catch: `pg` attaches both to the thrown
 * error (`error.code`, `error.constraint`), the same shape
 * `tests/integration/family-invite.test.ts`'s `expectRejection` asserts
 * against with a regex on the message. Any other DB error — a dropped
 * connection, a constraint nobody anticipated — must not be reported as "you
 * already invited them"; that would send the owner looking for a link that
 * does not exist.
 */
function isLiveMemberInviteConflict(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  const constraint = (error as { constraint?: unknown }).constraint;
  if (code === '23505' && constraint === 'member_invite_live_member_unique') return true;
  // Fallback for drivers/wrappers that do not surface `.constraint` directly
  // (e.g. an error re-thrown by a pooler): the constraint name still appears
  // in the message, same as `expectRejection`'s own regex.
  return /member_invite_live_member_unique/.test(error.message);
}

export async function createInviteAction(input: CreateInviteInput): Promise<CreateInviteState> {
  const principal = await assertCan('member:manage').catch(() => null);
  if (!principal || principal.kind !== 'member') return createInviteFailure('forbidden');

  const parsed = createInviteSchema.safeParse(input);
  if (!parsed.success) return createInviteFailure('invalidInput');

  let minted: Awaited<ReturnType<typeof mintInvite>>;
  try {
    minted = await mintInvite({
      familyId: principal.familyId,
      memberId: parsed.data.memberId,
      email: parsed.data.email,
      invitedByMemberId: principal.memberId,
    });
  } catch (error) {
    // The partial unique index refusing a second live invite for the same
    // member is the *expected* way to land here — narrowed to that specific
    // constraint, by name, so it is not an error worth a stack trace: the
    // owner already has a link for this person. Anything else (a dropped
    // connection, a constraint nobody anticipated) is a real failure and must
    // not be reported as "you already invited them" — that would send the
    // owner looking for a link that does not exist.
    if (isLiveMemberInviteConflict(error)) return createInviteFailure('inviteExists');

    console.error('[invite] mint failed', error);
    return createInviteFailure('inviteFailed');
  }

  if (!minted) return createInviteFailure('memberNotInvitable');

  revalidatePath(`/${await getLocale()}/family`);

  return {
    status: 'created',
    url: inviteUrlFor(env.BETTER_AUTH_URL, await getLocale(), minted.token),
    email: minted.invite.email,
    expiresAt: minted.invite.expiresAt.getTime(),
  };
}

export async function revokeInviteAction(input: { inviteId: string }): Promise<ActionState> {
  const principal = await assertCan('member:manage').catch(() => null);
  if (!principal) return failure('forbidden');

  const parsed = z.object({ inviteId: z.uuid() }).safeParse(input);
  if (!parsed.success) return failure('invalidInput');

  const revoked = await revokeInvite(principal.familyId, parsed.data.inviteId);
  if (!revoked) return failure('inviteNotFound');

  revalidatePath(`/${await getLocale()}/family`);
  return idleState;
}

/**
 * The password the invite-created account is born with.
 *
 * 32 bytes of system entropy that nobody — not the invitee, not the owner, not
 * this process after the call returns — ever sees. FR26 is explicit that the
 * second parent enters no data, and better-auth's email/password provider
 * requires *a* credential, so the credential is made unguessable and unused: the
 * session cookie issued at the end of `acceptInviteAction` is what actually
 * keeps them signed in (30 days, sliding).
 *
 * Known limitation, deliberately scoped: until M10 lands an outbound mailer
 * there is no `forgetPassword` route back in if that cookie is ever lost. The
 * alternative — asking the invitee to choose a password — is the exact data
 * entry FR26 exists to remove, so the gap is carried rather than closed here.
 */
function generateInvitePassword(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Interaction one of three: accept.
 *
 * Creates the login and attaches it to the member row that already exists. The
 * order is forced by `src/server/auth.ts`'s `session.create.before` hook, which
 * stamps `activeFamilyId` + `memberId` onto a session by looking up the member
 * row for that user — so the member must be claimed *before* the session is
 * issued, or the very first cookie would be unscoped. Hence: sign up (with
 * `autoSignIn` off, so no session yet) → claim → sign in.
 *
 * Failure between those steps leaves an auth user with no household, which is
 * an account that can log in with nowhere to land. Same compensating delete as
 * `signUpAction`, for the same reason.
 *
 * @public-action Acceptance has no principal to authorize; the invite token
 * *is* the authorization, and everything that makes it one — single use,
 * unexpired, unrevoked, targeting a still-unclaimed member — is the predicate
 * of the claiming UPDATE in `claimInvite`, not a check that could be raced.
 */
export async function acceptInviteAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const resolved = await resolveInvite(read(formData, 'token'));
  if (!resolved) return failure('inviteInvalid');

  const state = inviteStateOf(resolved.invite, new Date());
  if (state !== 'pending') return failure(`invite_${state}`);

  const auth = getAuth();
  const requestHeaders = await headers();

  // Whatever credential this browser was carrying is discarded first:
  // acceptance establishes a new one, and a stale session would otherwise be
  // what `session.create.before` reads a scope from.
  await auth.api.signOut({ headers: requestHeaders }).catch(() => {});

  const email = resolved.invite.email;
  const password = generateInvitePassword();

  let signedUp: Awaited<ReturnType<typeof auth.api.signUpEmail>>;
  try {
    signedUp = await auth.api.signUpEmail({
      // The display name comes from the member row the owner already filled in
      // — the invitee types nothing, here or anywhere else in this flow.
      body: { name: resolved.member.displayName, email, password },
      headers: requestHeaders,
    });
  } catch (error) {
    // F2: every failure branch of this action used to discard `error` after
    // reading `.message` once — which meant the one occurrence anybody would
    // ever see in production had nothing to grep for. Logged before the
    // message is classified, so the raw cause survives even when the
    // classification below is wrong.
    console.error('[invite] sign-up failed', error);
    const message = error instanceof Error ? error.message : '';
    return failure(/exist|taken|unique/i.test(message) ? 'inviteEmailTaken' : 'inviteFailed');
  }

  // F11 turned this up: `signUpEmail` does **not** throw for a duplicate
  // email under this app's config. `emailAndPassword.autoSignIn: false` (see
  // `server/auth.ts`) makes better-auth's own anti-enumeration guard kick in
  // — a sign-up attempt against an existing address gets a *synthetic*
  // success response instead (a freshly generated id, `token: null`, nothing
  // written to `user`), specifically so a sign-up endpoint cannot be used to
  // probe which emails are registered. The `catch` block above is therefore
  // dead code for exactly the case its comment describes, and the invitee
  // fell through to `claimInvite` with a `userId` that has no row —
  // discovered as a foreign-key violation there rather than as
  // `inviteEmailTaken` here. This is the authoritative check: a synthetic
  // response is definitionally one that never persisted, so its absence from
  // `user` is what `inviteEmailTaken` actually means.
  const [persisted] = await getDb()
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, signedUp.user.id))
    .limit(1);

  if (!persisted) {
    console.error('[invite] sign-up returned a synthetic user — the email is already registered');
    return failure('inviteEmailTaken');
  }

  const claim = await claimInvite({ inviteId: resolved.invite.id, userId: signedUp.user.id });

  if (!claim.ok) {
    console.error('[invite] claim failed', { reason: claim.reason, inviteId: resolved.invite.id });
    await getDb()
      .delete(user)
      .where(eq(user.id, signedUp.user.id))
      .catch(() => {});
    return failure(claim.reason === 'alreadyClaimed' ? 'invite_claimed' : 'inviteFailed');
  }

  try {
    await auth.api.signInEmail({ body: { email, password }, headers: requestHeaders });
  } catch (error) {
    console.error('[invite] sign-in failed, retrying once', error);
    // One retry, sign-in only — never on `signUpEmail` or `claimInvite`
    // above. The claim already happened by this point (its own UPDATE is the
    // single-use latch), so re-running *that* would either be a no-op or, on
    // a real conflict, a false "member taken". `signInEmail` has none of
    // that history: it is a stateless credential check against a password
    // this process generated and nobody else can present, so retrying it
    // cannot double-claim, double-create or do anything a second time that
    // the first attempt did not already risk. This is the flake-suspect: a
    // `signInEmail` failing purely from contention (a timed-out DB
    // connection under a loaded test run, not a wrong credential) is exactly
    // what one retry recovers from, and logging it here is what makes a real
    // recurrence diagnosable if this guess is wrong.
    try {
      await auth.api.signInEmail({ body: { email, password }, headers: requestHeaders });
    } catch (retryError) {
      console.error('[invite] sign-in retry failed', retryError);
      // The claim stands; only the auto-login failed. Nothing to compensate —
      // but this account has no password anybody knows, so say so rather than
      // stranding them on a screen that looks like it worked.
      return failure('inviteFailed');
    }
  }

  /**
   * A redirect, not a `revalidatePath`, and the difference is the whole step.
   *
   * `signInEmail` sets a *new* session cookie, which `nextCookies()` puts on
   * the response — but the re-render a revalidation triggers happens inside
   * this same response, reading the cookies the browser sent with the
   * *request*, which are the ones from before the sign-in. The invite page
   * would look up "is the session user the one who claimed this?", find no
   * session at all, and show the already-claimed screen to the person who just
   * claimed it. Redirecting makes the next render a fresh request that carries
   * the new cookie, which is the same reason `signUpAction` ends this way.
   */
  redirect({ href: `/invite/${read(formData, 'token')}`, locale: await getLocale() });
  // `redirect()` throws — unreachable, but the signature must stay total.
  return idleState;
}

const inviteProfileSchema = z.object({
  avatarUrl: z.enum(AVATAR_URLS),
  color: z.enum(MEMBER_COLORS),
});

/** Invite tokens are 43 base64url characters; anything else is not one. */
const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/**
 * Interaction two of three: pick an avatar and colour.
 *
 * Authorized by `member:self`, which grades `own` — so this can only ever write
 * the caller's own row, and a second parent holding the `adult` column can do
 * it without holding owner-only `member:manage`. Both fields are closed sets
 * (the eight built-in avatars, the eight design-system colours); there is no
 * free-text field on this screen and no free-text field in this schema.
 */
export async function chooseProfileAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') return failure('forbidden');

  const permitted = await assertCan('member:self', { ownerMemberId: principal.memberId })
    .then(() => true)
    .catch(() => false);
  if (!permitted) return failure('forbidden');

  const parsed = inviteProfileSchema.safeParse({
    avatarUrl: read(formData, 'avatarUrl'),
    color: read(formData, 'color'),
  });
  if (!parsed.success) return failure('invalidInput');

  const now = new Date();

  await getDb()
    .update(member)
    .set({ avatarUrl: parsed.data.avatarUrl, color: parsed.data.color, updatedAt: now })
    .where(and(eq(member.id, principal.memberId), eq(member.familyId, principal.familyId)));

  /**
   * Called from the invite flow, this hands the invitee straight to step three.
   * The token is only ever used to build a path back to a route that re-derives
   * everything from the database anyway — it confers nothing here, and it is
   * shape-checked before it is interpolated so it cannot become some other URL.
   */
  const token = read(formData, 'token');
  const hasInviteToken = inviteTokenSchema.safeParse(token).success;

  // F10: this is the *only* write to `profileCompletedAt` anywhere. It marks
  // "the invitee completed step 2 in this flow" as an independent fact from
  // whatever `member.avatarUrl` says — see the column comment in
  // `schema.ts`. Scoped to `memberId` (the same row `member:self` just
  // authorized writing to), not to a bare token match, so this can only ever
  // mark the caller's own invite as done.
  if (hasInviteToken) {
    await getDb()
      .update(memberInvite)
      .set({ profileCompletedAt: now, updatedAt: now })
      .where(
        and(
          eq(memberInvite.tokenHash, hashInviteToken(token)),
          eq(memberInvite.memberId, principal.memberId)
        )
      );
  }

  const locale = await getLocale();
  revalidatePath(`/${locale}/family`);

  if (hasInviteToken) {
    redirect({ href: `/invite/${token}`, locale });
  }

  return idleState;
}
