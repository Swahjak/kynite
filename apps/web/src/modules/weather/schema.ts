import {
  doublePrecision,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from '@/server/db/columns';
import { family } from '@/modules/family/schema';
import type { WeatherSnapshot } from './domain/snapshot';

/**
 * The cached reading for one household — the whole reason this slice has a
 * table at all.
 *
 * The hub re-renders constantly (every realtime frame, every idle-return,
 * every tab switch), so the read path must never touch the network. It reads
 * this row. A background job (`jobs.ts`) is the only writer.
 *
 * ## Why the snapshot is a jsonb blob and not columns
 *
 * Nothing in the app ever queries *into* a weather reading — there is no "find
 * families where it will rain", no join, no index on temperature. It is a
 * document that is written whole and read whole, and the shape is the
 * provider-independent `WeatherSnapshot` rather than Open-Meteo's wire format,
 * so swapping providers later changes `domain/open-meteo.ts` and nothing here.
 * Columns would buy a query nobody writes and cost a migration per field.
 *
 * ## Why the coordinates are duplicated out of the blob
 *
 * `latitude`/`longitude` are the *cache key*: they say what this reading is
 * for, and a household that moves must not be shown the old town's weather
 * while the next sweep is pending. `resolveWeatherView` compares them against
 * the family's current configuration and reports `unavailable` on a mismatch,
 * which is a cheap correctness guarantee that does not need the blob opened.
 *
 * One row per household (`weather_snapshot_family_unique`), upserted. History
 * is not kept: a wall display shows the weather, not a weather archive.
 */
export const weatherSnapshot = pgTable(
  'weather_snapshot',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    /** The coordinates this reading was fetched for — the cache key, not the payload. */
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    payload: jsonb('payload').$type<WeatherSnapshot>().notNull(),
    /** When we retrieved it. Every freshness decision measures from here. */
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    /**
     * Why the last refresh failed, as a stable key rather than an exception
     * string — the same convention as `ics_subscription.last_error`, and for
     * the same reason: a failing provider keeps its payload. The error is a
     * label on the row; the last good reading stays exactly where it is.
     */
    lastError: text('last_error'),
    lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex('weather_snapshot_family_unique').on(table.familyId)]
);

export type WeatherSnapshotRow = typeof weatherSnapshot.$inferSelect;
