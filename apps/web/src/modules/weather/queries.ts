import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb } from '@/server/db';
// The family table from the schema assembly point rather than the slice
// barrel — the same note (and the same import-cycle reason) as
// `modules/ics/refresh.ts`.
import { family } from '@/server/db/schema';
import {
  resolveWeatherView,
  weatherPlaceOf,
  type WeatherCacheEntry,
  type WeatherView,
} from './domain/snapshot';
import { weatherSnapshot } from './schema';

/**
 * The read the future hub widget calls. `server-only`, like every slice's
 * `queries.ts`.
 *
 * Three properties, and all three exist because the caller is a wall display:
 *
 * 1. **No network, ever.** One indexed row read. The provider is spoken to by
 *    the background job in `refresh.ts` and by nothing else, so a hub that
 *    renders forty times a minute costs forty selects and zero HTTP calls.
 * 2. **Never throws.** A database hiccup, a deleted family row, a payload that
 *    somehow is not a snapshot: all of it resolves to
 *    `{ status: 'unavailable' }`. Weather is the least important thing on the
 *    board and must never be the reason the board fails to render — the hub
 *    keeps working with no network at all, and this query is part of that
 *    promise rather than an exception to it.
 * 3. **Says which kind of nothing it has.** `unconfigured` (no location set)
 *    and `unavailable` (configured, nothing usable cached) are different
 *    sentences for a UI to draw; see `domain/snapshot.ts`.
 */
export async function getFamilyWeather(
  familyId: string,
  options: { now?: Date } = {}
): Promise<WeatherView> {
  const now = options.now ?? new Date();

  try {
    const [row] = await getDb()
      .select({
        latitude: family.weatherLatitude,
        longitude: family.weatherLongitude,
        label: family.weatherLocationLabel,
        snapshot: weatherSnapshot,
      })
      .from(family)
      .leftJoin(weatherSnapshot, eq(weatherSnapshot.familyId, family.id))
      .where(eq(family.id, familyId))
      .limit(1);

    if (!row) return { status: 'unconfigured' };

    return resolveWeatherView({
      place: weatherPlaceOf({
        latitude: row.latitude,
        longitude: row.longitude,
        label: row.label,
      }),
      entry: cacheEntryOf(row.snapshot),
      now,
    });
  } catch (error) {
    // Logged, not rethrown: see property 2 above.
    console.error('[weather] read failed', error);
    return { status: 'unavailable' };
  }
}

/** The stored row, or null when there is nothing usable in it. */
function cacheEntryOf(
  row: {
    latitude: number;
    longitude: number;
    fetchedAt: Date;
    payload: unknown;
  } | null
): WeatherCacheEntry | null {
  if (!row) return null;

  const payload = row.payload;
  // A payload written by an older shape of this slice is not a crash; it is a
  // cache miss, and the next sweep overwrites it.
  if (!payload || typeof payload !== 'object' || !('current' in payload)) return null;

  return {
    latitude: row.latitude,
    longitude: row.longitude,
    fetchedAt: row.fetchedAt,
    snapshot: payload as WeatherCacheEntry['snapshot'],
  };
}

/** Just the cached row, for the refresh path's hit/miss decision. */
export async function getWeatherCacheEntry(familyId: string): Promise<WeatherCacheEntry | null> {
  const [row] = await getDb()
    .select()
    .from(weatherSnapshot)
    .where(eq(weatherSnapshot.familyId, familyId))
    .limit(1);

  return cacheEntryOf(row ?? null);
}
