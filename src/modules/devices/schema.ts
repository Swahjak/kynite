import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from '@/server/db/columns';
import { family } from '@/modules/family/schema';

/** docs/architecture.md §3 "Devices & Google" + "Sharing, push, devices". */

export const deviceKind = pgEnum('device_kind', ['hub', 'mobile']);

/**
 * A paired client. The bearer secret never lives here — only its hash, and only
 * on `device_session`, so revoking a device is a row update, not a key rotation.
 */
export const device = pgTable(
  'device',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: deviceKind('kind').notNull(),
    pairedAt: timestamp('paired_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index('device_family_id_idx').on(table.familyId)]
);

/**
 * The credential itself: one year, sliding renewal (§3). Scoped to the family
 * transitively through `device` — a session cannot outlive its device row.
 */
export const deviceSession = pgTable(
  'device_session',
  {
    id: primaryId(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => device.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('device_session_token_hash_unique').on(table.tokenHash),
    index('device_session_device_id_idx').on(table.deviceId),
  ]
);

export type Device = typeof device.$inferSelect;
export type DeviceSession = typeof deviceSession.$inferSelect;
export type DeviceKind = (typeof deviceKind.enumValues)[number];

export const DEVICE_KINDS = deviceKind.enumValues;
