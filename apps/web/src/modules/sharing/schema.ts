import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from '@/server/db/columns';
import { family } from '@/modules/family/schema';
import { SHARE_SURFACES, type ShareLinkScope, type ShareSurface } from './domain/scope';

/** docs/architecture.md §3 "Sharing, push, devices" (PRD FR24/FR25). */

export const shareRole = pgEnum('share_role', ['viewer', 'contributor']);

/**
 * The scope vocabulary moved to `./domain/scope` in M13 — same values, same
 * stored shape, now reachable from pure code. The `(share)` route tree must not
 * transitively import a `'use server'` module (§2), which makes drizzle's
 * `schema.ts` the wrong place for anything that tree needs to *reason* with;
 * re-exported here so the stored column's type still reads off the table.
 */
export { SHARE_SURFACES, type ShareLinkScope, type ShareSurface };

/**
 * A no-account access grant (the babysitter link). Only the hash is stored —
 * the raw token is shown once at creation and is unrecoverable afterwards, so
 * a database read can never reconstruct a working link.
 */
export const shareLink = pgTable(
  'share_link',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    role: shareRole('role').notNull().default('viewer'),
    scope: jsonb('scope').$type<ShareLinkScope>().notNull().default({}),
    label: text('label'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    useCount: integer('use_count').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('share_link_token_hash_unique').on(table.tokenHash),
    index('share_link_family_id_idx').on(table.familyId),
  ]
);

export type ShareLink = typeof shareLink.$inferSelect;
export type ShareLinkRole = (typeof shareRole.enumValues)[number];

export const SHARE_ROLES = shareRole.enumValues;
