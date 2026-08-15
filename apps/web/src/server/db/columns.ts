import { timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Column builders shared by every slice's `schema.ts`.
 *
 * Drizzle re-evaluates a builder per table, so exporting these objects and
 * spreading them is safe (and is the documented reuse pattern). Keeping them
 * here — not in a slice — means no slice has to import another slice just to
 * agree on what "created_at" means.
 */

/** `docs/architecture.md` §3: all ids are uuid with `defaultRandom()`. */
export const primaryId = () => uuid('id').primaryKey().defaultRandom();

export const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** §3: all tables carry `createdAt`/`updatedAt` unless stated (append-only tables state it). */
export const timestamps = {
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};
