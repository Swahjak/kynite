import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from '@/server/db/columns';
import { family, member } from '@/modules/family/schema';
import { event } from '@/modules/calendar/schema';

/** docs/architecture.md §3 "Rewards". */

/** No money category, ever (§3) — the catalogue is privileges, experiences, treats. */
export const rewardCategory = pgEnum('reward_category', ['privilege', 'experience', 'treat']);

export const redemptionStatus = pgEnum('redemption_status', [
  'requested',
  'approved',
  'denied',
  'fulfilled',
]);

/** The per-family catalogue. `availableToMemberIds` makes it a per-child catalogue. */
export const reward = pgTable(
  'reward',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    icon: text('icon'),
    imageUrl: text('image_url'),
    costStars: integer('cost_stars').notNull(),
    category: rewardCategory('category').notNull(),
    /** Empty = available to every child in the family. */
    availableToMemberIds: uuid('available_to_member_ids').array().notNull().default([]),
    requiresApproval: boolean('requires_approval').notNull().default(true),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index('reward_family_id_idx').on(table.familyId),
    check('reward_cost_stars_non_negative', sql`${table.costStars} >= 0`),
  ]
);

/**
 * Spending is recorded here, never as a negative `star_ledger` row: "stars
 * earned" stays monotonic forever while "stars available" is derived
 * (`member_star_balance`). A denied redemption costs nothing — there is no
 * penalty path in the schema.
 */
export const redemption = pgTable(
  'redemption',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    rewardId: uuid('reward_id')
      .notNull()
      .references(() => reward.id, { onDelete: 'cascade' }),
    /** Frozen at request time: re-pricing the catalogue never re-prices a request. */
    costStars: integer('cost_stars').notNull(),
    status: redemptionStatus('status').notNull().default('requested'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decidedByMemberId: uuid('decided_by_member_id').references(() => member.id, {
      onDelete: 'set null',
    }),
    /** An approved reward can land on the calendar as a real event. */
    createdEventId: uuid('created_event_id').references(() => event.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    index('redemption_family_status_idx').on(table.familyId, table.status),
    index('redemption_family_member_idx').on(table.familyId, table.memberId),
    check('redemption_cost_stars_non_negative', sql`${table.costStars} >= 0`),
  ]
);

export type Reward = typeof reward.$inferSelect;
export type Redemption = typeof redemption.$inferSelect;
export type RewardCategory = (typeof rewardCategory.enumValues)[number];
export type RedemptionStatus = (typeof redemptionStatus.enumValues)[number];

export const REWARD_CATEGORIES = rewardCategory.enumValues;
export const REDEMPTION_STATUSES = redemptionStatus.enumValues;

/**
 * Redemption states that have actually consumed stars. `fulfilled` is
 * `approved` that has been handed over — both spend; `requested` and `denied`
 * never do.
 */
export const SPENDING_REDEMPTION_STATUSES = ['approved', 'fulfilled'] as const;
