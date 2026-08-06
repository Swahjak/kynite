import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from '@/server/db/columns';
import { family, member } from '@/modules/family/schema';
import { device } from '@/modules/devices/schema';

/** docs/architecture.md §3 "Sharing, push, devices" — the push half. */

/**
 * One Web Push endpoint per browser install. `failureCount` is the pruning
 * signal: a subscription that keeps returning 404/410 is dead and gets dropped
 * rather than retried forever.
 */
export const pushSubscription = pgTable(
  'push_subscription',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    /** Null for a subscription made outside a paired device (a plain browser). */
    deviceId: uuid('device_id').references(() => device.id, { onDelete: 'set null' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    failureCount: integer('failure_count').notNull().default(0),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('push_subscription_endpoint_unique').on(table.endpoint),
    index('push_subscription_family_member_idx').on(table.familyId, table.memberId),
  ]
);

export type PushSubscription = typeof pushSubscription.$inferSelect;
