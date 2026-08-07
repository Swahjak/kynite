import { sql } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from '@/server/db/auth-schema';

/** docs/architecture.md §3 "Identity & household". */

export const memberRole = pgEnum('member_role', ['owner', 'adult', 'child', 'caregiver']);

/** Research §Rewards: 4–7 needs an instant payoff, 8–12 can save towards one. */
export const rewardHorizon = pgEnum('reward_horizon', ['instant', 'savings']);

/**
 * The eight category colors of the design system (src/app/globals.css).
 * A member owns their color everywhere, so it is constrained at the database
 * level rather than left as free text.
 */
export const memberColor = pgEnum('member_color', [
  'blue',
  'purple',
  'orange',
  'green',
  'red',
  'yellow',
  'pink',
  'teal',
]);

/**
 * Which board a wall display opens on (PRD FR28, M16).
 *
 * Only the two shapes the hub can actually draw at 6-foot scale: the
 * per-person day columns, or the "what is coming up" agenda list. `week` and
 * `month` are in `CALENDAR_VIEWS` for the parent app and deliberately not
 * here — a month grid on a kitchen wall is unreadable from across the room,
 * so offering it would be offering a setting that makes the hub worse.
 */
export const hubView = pgEnum('hub_view', ['day', 'agenda']);

export const family = pgTable('family', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  locale: text('locale').notNull().default('nl'),
  timezone: text('timezone').notNull().default('Europe/Amsterdam'),
  /** ISO-8601: 1 = Monday. */
  weekStartsOn: smallint('week_starts_on').notNull().default(1),
  /**
   * The hub's default board (FR28). Family-level, not device-level, and that
   * is the point of the criterion "takes effect on the hub without
   * re-pairing": a parent changes it in the Controller and every wall display
   * in the house follows on the next render, because none of them stores a
   * preference of its own.
   */
  hubDefaultView: hubView('hub_default_view').notNull().default('day'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per human. `userId` is null for children (who never log in) and for
 * unclaimed adults — second-parent onboarding is *claiming* an existing member
 * (PRD FR26), which is why member is decoupled from the auth `user`.
 */
export const member = pgTable(
  'member',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    color: memberColor('color').notNull().default('blue'),
    role: memberRole('role').notNull(),
    birthDate: date('birth_date'),
    rewardHorizon: rewardHorizon('reward_horizon').notNull().default('instant'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('member_family_id_idx').on(table.familyId),
    // A login belongs to exactly one member per family.
    uniqueIndex('member_family_user_unique')
      .on(table.familyId, table.userId)
      .where(sql`${table.userId} is not null`),
  ]
);

/**
 * A single-use, expiring, revocable link that attaches a login to one already
 * existing `member` row (PRD FR26, milestone M14).
 *
 * The table stores a *pointer to a member*, never a role and never a name. That
 * is the whole anti-escalation design: acceptance can only ever confer whatever
 * the target row already says, and the target row was created by the owner
 * through `member:manage`. There is no field here a client could tamper with to
 * arrive as an owner.
 *
 * `memberId` is unique among live invites rather than outright, so an owner who
 * lets one lapse can mint another for the same person, and the spent one stays
 * in the list as history.
 */
export const memberInvite = pgTable(
  'member_invite',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    /** The unclaimed row this invite hands over. Cascades: no member, no invite. */
    memberId: uuid('member_id')
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    /** SHA-256 of the raw token, `invite:`-domain-separated (`@/lib/invite-token`). */
    tokenHash: text('token_hash').notNull(),
    /**
     * The address the account is created under. The *owner* types this when
     * minting; the invitee never types anything (FR26), so the login has to
     * carry an identifier that was known before they arrived.
     */
    email: text('email').notNull(),
    /** Who minted it — kept for the audit trail the owner reads in the roster. */
    invitedByMemberId: uuid('invited_by_member_id').references(() => member.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Set by the claiming UPDATE. Non-null = spent; this is the single-use latch. */
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    /** The login the claim created or attached, for the already-claimed screen. */
    claimedByUserId: text('claimed_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    /**
     * Set once the invitee submits `chooseProfileAction` — interaction two of
     * three (F10). Deriving step 2 from `member.avatarUrl IS NULL` looked
     * equivalent and was not: an owner who pre-sets an avatar on the member
     * row before minting (or edits it while the invite is outstanding) makes
     * `avatarUrl` non-null before the invitee ever visits the profile step,
     * which silently skips it — the invitee never gets their own tap at
     * "this is me." This column is the explicit marker instead: it means
     * "the invitee did this step in *this* flow," which `avatarUrl` alone
     * cannot say no matter who else has touched the member row.
     */
    profileCompletedAt: timestamp('profile_completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('member_invite_token_hash_unique').on(table.tokenHash),
    index('member_invite_family_id_idx').on(table.familyId),
    // At most one *live* invite per member: two links in circulation for the
    // same person is two chances for the wrong one to be forwarded.
    uniqueIndex('member_invite_live_member_unique')
      .on(table.memberId)
      .where(sql`${table.claimedAt} is null and ${table.revokedAt} is null`),
  ]
);

/**
 * A tombstone: this login once held a member row in this household (M19, F4).
 *
 * `member` is hard-deleted — `deleteMemberAction` removes the row outright,
 * because a soft-deleted member would have to be filtered out of every board,
 * every roster and every star query in the app, and one missed predicate there
 * is a removed person reappearing on a kitchen wall. The cost of that choice is
 * that the database afterwards cannot tell **"this login never had a
 * household"** from **"this login had one taken away"**, and those two states
 * need opposite treatment: the first is a social first run, and belongs on
 * `(auth)/onboarding`; the second is a person who was removed, and must not be
 * handed a form that quietly makes them the owner of a brand new household.
 *
 * So the fact is recorded separately and append-only. It stores no name, no
 * role and no profile — only that the pairing existed and when it ended. It is
 * family-scoped and cascades with the household on purpose: once the family is
 * gone there is nothing left to have been removed from, and a login with no
 * household anywhere is a first run again.
 */
export const formerMember = pgTable(
  'former_member',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    removedAt: timestamp('removed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // The read is always "has *this login* ever been a member?", on the
    // onboarding path, on every request that reaches it.
    index('former_member_user_id_idx').on(table.userId),
  ]
);

export type Family = typeof family.$inferSelect;
export type FormerMember = typeof formerMember.$inferSelect;
export type Member = typeof member.$inferSelect;
export type MemberInvite = typeof memberInvite.$inferSelect;
export type MemberRole = (typeof memberRole.enumValues)[number];
export type MemberColor = (typeof memberColor.enumValues)[number];
export type RewardHorizon = (typeof rewardHorizon.enumValues)[number];
export type HubView = (typeof hubView.enumValues)[number];

export const MEMBER_ROLES = memberRole.enumValues;
export const MEMBER_COLORS = memberColor.enumValues;
export const REWARD_HORIZONS = rewardHorizon.enumValues;
export const HUB_VIEWS = hubView.enumValues;
