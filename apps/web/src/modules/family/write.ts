import 'server-only';
import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/server/db';
// Table objects from the schema assembly point, not this module's own
// `./schema` — same note as `./actions.ts`: `session` is a better-auth table,
// not slice-owned, so it comes from `auth-schema` directly.
import { family, formerMember, member } from '@/server/db/schema';
import { session as sessionTable } from '@/server/db/auth-schema';
import { locales } from '@/i18n/routing';
import { FORMATTING_LOCALES } from '@/i18n/formatting-locale';
import { publish } from '@/modules/realtime';
import { can, type Principal } from './authorize';
import { MEMBER_COLORS, MEMBER_ROLES, REWARD_HORIZONS, type MemberRole } from './schema';
import { MAX_CUSTOM_AVATAR_URI_LENGTH, checkCustomAvatar } from './domain/avatar';
import { MEMBER_AVATARS, avatarUrlFor } from './ui/tokens';
import { actionFailure as failure, idleState, type ActionState } from './action-state';

/**
 * The write seam for the family slice (MCP milestone M4).
 *
 * Same shape and the same discipline as `modules/rewards/write.ts` and
 * `modules/timers/write.ts`: every function takes an explicit `Principal`,
 * calls `can()` itself rather than trusting the caller, validates its own
 * input, and imports nothing from `next/cache` — revalidation is the
 * caller's concern (`./actions.ts` does it for the web app; `/api/mcp`'s
 * tools do not, since there is no page to revalidate). `./actions.ts` is now
 * a set of thin wrappers over these (assertCan → delegate → revalidate), and
 * `/api/mcp/tools/family.ts` calls the same functions with the principal
 * resolved from a bearer token. MCP never imports a Server Action.
 *
 * Out of scope for this seam (per the milestone brief): invites, the hub
 * display setting, family deletion, `chooseProfile`, and every sign-in/up/out
 * action — those stay exactly where they are in `./actions.ts`.
 *
 * The two guards that matter stay here, not just at the UI layer: an owner
 * row can never be removed (`deleteMember`) and a role can never cross the
 * owner/non-owner line in either direction (`createMember`/`updateMember`) —
 * both are what keep "exactly one owner per family" true regardless of which
 * caller (web app or MCP) reaches this seam.
 */

const trimmed = z.string().trim();

/** The built-in avatar set — the only *paths* a member may carry. */
const AVATAR_URLS = MEMBER_AVATARS.map(avatarUrlFor) as [string, ...string[]];
const PRESET_AVATAR_URLS: ReadonlySet<string> = new Set(AVATAR_URLS);

const avatarUrlSchema = z
  .string()
  .max(MAX_CUSTOM_AVATAR_URI_LENGTH)
  .refine(
    (value) => value === '' || PRESET_AVATAR_URLS.has(value) || checkCustomAvatar(value).ok,
    'avatar'
  );

const memberSchema = z.object({
  displayName: trimmed.min(1).max(80),
  role: z.enum(MEMBER_ROLES),
  color: z.enum(MEMBER_COLORS),
  rewardHorizon: z.enum(REWARD_HORIZONS),
  avatarUrl: avatarUrlSchema,
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
});

export type MemberInput = z.input<typeof memberSchema>;

/** A member (or an MCP client acting for the household) is added (§7 `member:manage`). */
export async function createMember(principal: Principal, input: MemberInput): Promise<ActionState> {
  if (!can(principal, 'member:manage', { familyId: principal.familyId })) {
    return failure('forbidden');
  }

  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return failure('invalidInput');

  const body = parsed.data;
  // Exactly one owner per family, minted at sign-up: this path never creates
  // a second one.
  if (body.role === 'owner') return failure('singleOwner');

  const db = getDb();
  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${member.sortOrder}), -1) + 1` })
    .from(member)
    .where(eq(member.familyId, principal.familyId));

  // Children never get a login: `userId` stays null (docs/architecture.md §3).
  await db.insert(member).values({
    familyId: principal.familyId,
    displayName: body.displayName,
    role: body.role as MemberRole,
    color: body.color,
    rewardHorizon: body.rewardHorizon,
    avatarUrl: body.avatarUrl || null,
    birthDate: body.birthDate || null,
    sortOrder: Number(next),
  });

  return idleState;
}

export type UpdateMemberInput = MemberInput & { memberId: string };

export async function updateMember(
  principal: Principal,
  input: UpdateMemberInput
): Promise<ActionState> {
  if (
    !can(principal, 'member:manage', { familyId: principal.familyId, memberId: input.memberId })
  ) {
    return failure('forbidden');
  }

  if (!z.uuid().safeParse(input.memberId).success) return failure('invalidInput');

  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return failure('invalidInput');

  const body = parsed.data;
  const db = getDb();

  const [existing] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.id, input.memberId), eq(member.familyId, principal.familyId)))
    .limit(1);

  if (!existing) return failure('memberNotFound');
  // Exactly one owner per family: the role of the owner row is immutable here.
  if (existing.role === 'owner' && body.role !== 'owner') return failure('singleOwner');
  if (existing.role !== 'owner' && body.role === 'owner') return failure('singleOwner');

  await db
    .update(member)
    .set({
      displayName: body.displayName,
      role: body.role as MemberRole,
      color: body.color,
      rewardHorizon: body.rewardHorizon,
      avatarUrl: body.avatarUrl || null,
      birthDate: body.birthDate || null,
      updatedAt: new Date(),
    })
    .where(and(eq(member.id, input.memberId), eq(member.familyId, principal.familyId)));

  return idleState;
}

export type DeleteMemberInput = { memberId: string };

export async function deleteMember(
  principal: Principal,
  input: DeleteMemberInput
): Promise<ActionState> {
  if (
    !can(principal, 'member:manage', { familyId: principal.familyId, memberId: input.memberId })
  ) {
    return failure('forbidden');
  }

  if (!z.uuid().safeParse(input.memberId).success) return failure('invalidInput');

  const db = getDb();
  const [existing] = await db
    .select({ role: member.role, userId: member.userId })
    .from(member)
    .where(and(eq(member.id, input.memberId), eq(member.familyId, principal.familyId)))
    .limit(1);

  if (!existing) return failure('memberNotFound');
  // The owner row can never be removed — which is also what keeps a member
  // from ever deleting themselves via this path, since only the owner holds
  // `member:manage` in the first place (§7's matrix: `deny` for every other
  // column).
  if (existing.role === 'owner') return failure('cannotRemoveOwner');

  // F4: removing a member with a login is removing *access* — the row, a
  // tombstone (so `(auth)/onboarding` can tell "never had a household" from
  // "had one taken away"), and their sessions, all in one transaction. See
  // `./actions.ts`'s prior doc comment on `deleteMemberAction` for the full
  // reasoning; unchanged by this extraction.
  await db.transaction(async (tx) => {
    await tx
      .delete(member)
      .where(and(eq(member.id, input.memberId), eq(member.familyId, principal.familyId)));

    if (existing.userId) {
      await tx.insert(formerMember).values({
        userId: existing.userId,
        familyId: principal.familyId,
      });
      await tx.delete(sessionTable).where(eq(sessionTable.userId, existing.userId));
    }
  });

  return idleState;
}

export type ReorderMemberInput = { memberId: string; direction: 'up' | 'down' };

/**
 * Swap a member with its board-order neighbour (M1, adjustable member order).
 *
 * Reads the whole family's roster in board order, swaps the target with the
 * neighbour in that array (not just the two `sortOrder` values — see below),
 * then renumbers every row `0..n-1` in one transaction. Renumbering the whole
 * list rather than swapping the two `sortOrder` values directly is what keeps
 * the invariant "board order is always a dense `0..n-1` sequence" true even
 * starting from a roster with gaps or ties (pre-migration-`0035` data, or a
 * row created concurrently) — a bare value swap would preserve whatever gap
 * or tie was already there.
 */
export async function reorderMember(
  principal: Principal,
  input: ReorderMemberInput
): Promise<ActionState> {
  if (
    !can(principal, 'member:manage', { familyId: principal.familyId, memberId: input.memberId })
  ) {
    return failure('forbidden');
  }

  if (!z.uuid().safeParse(input.memberId).success) return failure('invalidInput');
  if (input.direction !== 'up' && input.direction !== 'down') return failure('invalidInput');

  const db = getDb();
  const rows = await db
    .select({ id: member.id, sortOrder: member.sortOrder })
    .from(member)
    .where(eq(member.familyId, principal.familyId))
    .orderBy(asc(member.sortOrder), asc(member.createdAt));

  const index = rows.findIndex((row) => row.id === input.memberId);
  if (index === -1) return failure('memberNotFound');

  const neighborIndex = input.direction === 'up' ? index - 1 : index + 1;
  // Already at the edge the caller asked to move past: a no-op, not a refusal
  // — the UI disables the button at the ends, but MCP has no button to
  // disable, so this has to be a legal (if pointless) call.
  if (neighborIndex < 0 || neighborIndex >= rows.length) return idleState;

  const reordered = [...rows];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(neighborIndex, 0, moved);

  await db.transaction(async (tx) => {
    for (const [position, row] of reordered.entries()) {
      if (row.sortOrder === position) continue;
      await tx
        .update(member)
        .set({ sortOrder: position, updatedAt: new Date() })
        .where(and(eq(member.id, row.id), eq(member.familyId, principal.familyId)));
    }
  });

  return idleState;
}

export type SetMemberOrderInput = { orderedIds: string[] };

/**
 * The MCP twin of `reorderMember`: takes the *whole* new order at once
 * (`reorder_members`'s natural shape for a tool call) rather than one swap.
 * `orderedIds` must be exactly the family's current member ids, each once —
 * anything else (a foreign id, a missing member, a duplicate) is refused
 * outright and nothing is written, since a partial application would leave
 * the roster in an order nobody asked for.
 */
export async function setMemberOrder(
  principal: Principal,
  input: SetMemberOrderInput
): Promise<ActionState> {
  if (!can(principal, 'member:manage', { familyId: principal.familyId })) {
    return failure('forbidden');
  }

  const parsed = z.array(z.uuid()).safeParse(input.orderedIds);
  if (!parsed.success) return failure('invalidInput');
  const orderedIds = parsed.data;

  const db = getDb();
  const rows = await db
    .select({ id: member.id })
    .from(member)
    .where(eq(member.familyId, principal.familyId));

  const currentIds = new Set(rows.map((row) => row.id));
  const providedIds = new Set(orderedIds);
  const isExactMatch =
    orderedIds.length === rows.length &&
    providedIds.size === orderedIds.length &&
    orderedIds.every((id) => currentIds.has(id));

  if (!isExactMatch) return failure('invalidInput');

  await db.transaction(async (tx) => {
    for (const [position, memberId] of orderedIds.entries()) {
      await tx
        .update(member)
        .set({ sortOrder: position, updatedAt: new Date() })
        .where(and(eq(member.id, memberId), eq(member.familyId, principal.familyId)));
    }
  });

  return idleState;
}

/**
 * A timezone is valid iff the platform's own ICU database knows it. See
 * `./actions.ts`'s prior doc comment on `updateFamilyAction` for why this is
 * not an enum.
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
  formattingLocale: z.enum(FORMATTING_LOCALES),
  timezone: trimmed.min(1).max(64).refine(isKnownTimeZone),
  weekStartsOn: z.coerce.number().int().min(1).max(7),
});

export type FamilySettingsInput = z.input<typeof familySettingsSchema>;

/** The household's own identity (§7 `family:manage`, owner-only). */
export async function updateFamily(
  principal: Principal,
  input: FamilySettingsInput
): Promise<ActionState> {
  if (
    !can(principal, 'family:manage', { familyId: principal.familyId }) ||
    principal.kind !== 'member'
  ) {
    return failure('forbidden');
  }

  const parsed = familySettingsSchema.safeParse(input);
  if (!parsed.success) return failure('invalidInput');

  const body = parsed.data;

  await getDb().transaction(async (tx) => {
    await tx
      .update(family)
      .set({
        name: body.name,
        locale: body.locale,
        formattingLocale: body.formattingLocale,
        timezone: body.timezone,
        weekStartsOn: body.weekStartsOn,
        updatedAt: new Date(),
      })
      .where(eq(family.id, principal.familyId));

    await publish(
      {
        familyId: principal.familyId,
        type: 'settings.updated',
        entity: { id: principal.familyId },
        actor: { memberId: principal.memberId, source: 'mobile' },
        patch: {
          locale: body.locale,
          formattingLocale: body.formattingLocale,
          timezone: body.timezone,
        },
      },
      tx
    );
  });

  return idleState;
}
