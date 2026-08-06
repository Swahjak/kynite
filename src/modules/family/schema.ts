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

export const family = pgTable('family', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  locale: text('locale').notNull().default('nl'),
  timezone: text('timezone').notNull().default('Europe/Amsterdam'),
  /** ISO-8601: 1 = Monday. */
  weekStartsOn: smallint('week_starts_on').notNull().default(1),
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

export type Family = typeof family.$inferSelect;
export type Member = typeof member.$inferSelect;
export type MemberRole = (typeof memberRole.enumValues)[number];
export type MemberColor = (typeof memberColor.enumValues)[number];
export type RewardHorizon = (typeof rewardHorizon.enumValues)[number];

export const MEMBER_ROLES = memberRole.enumValues;
export const MEMBER_COLORS = memberColor.enumValues;
export const REWARD_HORIZONS = rewardHorizon.enumValues;
