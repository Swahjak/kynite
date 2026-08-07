import { sql } from 'drizzle-orm';
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, primaryId, timestamps } from '@/server/db/columns';
import { family, member } from '@/modules/family/schema';

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

/**
 * A pending pairing code (§7: "parent generates a 6-digit code (10-min TTL)").
 *
 * Three properties are carried by the schema rather than by the action:
 *
 *  - **single use** — `consumedAt`/`consumedByDeviceId` are stamped by the
 *    exchange, and the exchange only matches `consumed_at is null`. Replaying
 *    a code that already paired a tablet matches nothing.
 *  - **unambiguous resolution** — the hub types six digits and nothing else,
 *    so the lookup is by hash across *every* family. The partial unique index
 *    guarantees at most one unconsumed row can hold a given hash, which is
 *    what makes "the code identifies one family" true rather than hopeful.
 *    Generation retries on the conflict (`modules/devices/queries.ts`).
 *  - **no plaintext at rest** — the digits are hashed like any other bearer
 *    secret; the raw value exists in the parent's screen and nowhere else.
 *
 * The device is *named* here, at generation time, by the parent — a wall
 * tablet cannot be expected to type "Kitchen" on a keyboard it does not have,
 * and a device list of "Unknown device" ×3 is not revocable in practice.
 */
export const devicePairingCode = pgTable(
  'device_pairing_code',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    deviceName: text('device_name').notNull(),
    kind: deviceKind('kind').notNull().default('hub'),
    createdByMemberId: uuid('created_by_member_id').references(() => member.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    consumedByDeviceId: uuid('consumed_by_device_id').references(() => device.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('device_pairing_code_hash_unclaimed_unique')
      .on(table.codeHash)
      .where(sql`consumed_at is null`),
    index('device_pairing_code_family_id_idx').on(table.familyId),
    index('device_pairing_code_expires_at_idx').on(table.expiresAt),
  ]
);

/**
 * Failed pairing attempts, for the rate limit in `lib/device-session.ts`.
 *
 * Only *failures* are recorded, and only a fingerprint of the caller — never
 * the code that was tried, which would turn this table into a list of near
 * misses. Rows are pruned by `maintenance:trim`; nothing reads them outside
 * the sliding window.
 *
 * Append-only, so no `updatedAt`.
 */
export const devicePairingAttempt = pgTable(
  'device_pairing_attempt',
  {
    id: primaryId(),
    /** SHA-256 of the client IP + user agent. Never the raw address. */
    clientHash: text('client_hash').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('device_pairing_attempt_client_idx').on(table.clientHash, table.createdAt),
    // The global budget (`PAIRING_GLOBAL_MAX_FAILURES`) scans every row in the
    // window regardless of client, so it needs its own index on `createdAt`
    // alone — the composite index above is only useful when `clientHash` is
    // also in the predicate.
    index('device_pairing_attempt_created_at_idx').on(table.createdAt),
  ]
);

export type Device = typeof device.$inferSelect;
export type DevicePairingCode = typeof devicePairingCode.$inferSelect;
export type DeviceSession = typeof deviceSession.$inferSelect;
export type DeviceKind = (typeof deviceKind.enumValues)[number];

export const DEVICE_KINDS = deviceKind.enumValues;
