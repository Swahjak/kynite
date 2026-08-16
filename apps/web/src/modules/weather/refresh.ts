import 'server-only';
import { and, eq, isNotNull } from 'drizzle-orm';
import { getDb } from '@/server/db';
// See the note in `./queries.ts` on importing `family` from the assembly point.
import { family } from '@/server/db/schema';
import { fetchWeather, type WeatherFetchFailure, type WeatherFetchOptions } from './client';
import { shouldRefetchWeather, weatherPlaceOf } from './domain/snapshot';
import { getWeatherCacheEntry } from './queries';
import { weatherSnapshot } from './schema';

/**
 * One household's weather, refreshed — the only writer of `weather_snapshot`.
 *
 * The shape is `modules/ics/refresh.ts`'s, because the problem is the same one:
 * a third party we do not control, polled on a schedule, whose failures are
 * ordinary rather than exceptional.
 *
 * **Failures keep the reading.** Unreachable, timed out, HTTP 503, a
 * maintenance page where JSON should be: each records `lastError` on the row,
 * leaves `payload` and `fetchedAt` untouched, and returns. The hub then keeps
 * showing the last good reading, ageing into `freshness: 'stale'` and
 * eventually disappearing at 24 hours (`domain/snapshot.ts`). A wall display
 * that blanks the moment somebody else's free API has a bad afternoon would be
 * a worse product than one that says "half past nine this morning".
 *
 * The one thing that is *not* written on failure is a partial snapshot: the
 * parser in `domain/open-meteo.ts` returns null for anything unexpected, and a
 * null never reaches this table.
 */

export type WeatherRefreshFailure = WeatherFetchFailure;

export type WeatherRefreshOutcome =
  | { status: 'refreshed' }
  /** The cache was still inside the refetch window — no call was made. */
  | { status: 'cached' }
  | { status: 'skipped'; reason: 'not-found' | 'unconfigured' }
  | { status: 'failed'; error: WeatherRefreshFailure };

export type WeatherRefreshOptions = WeatherFetchOptions & {
  /** Refetch even on a cache hit — what a just-changed location wants. */
  force?: boolean;
};

/** The `weather:refresh` sweep's row set: every household with a location. */
export async function listWeatherFamilyIds(): Promise<string[]> {
  const rows = await getDb()
    .select({ id: family.id })
    .from(family)
    .where(and(isNotNull(family.weatherLatitude), isNotNull(family.weatherLongitude)));

  return rows.map((row) => row.id);
}

export async function refreshFamilyWeather(
  familyId: string,
  options: WeatherRefreshOptions = {}
): Promise<WeatherRefreshOutcome> {
  const db = getDb();
  const now = options.now ?? new Date();

  const [row] = await db
    .select({
      latitude: family.weatherLatitude,
      longitude: family.weatherLongitude,
      label: family.weatherLocationLabel,
    })
    .from(family)
    .where(eq(family.id, familyId))
    .limit(1);

  if (!row) return { status: 'skipped', reason: 'not-found' };

  const place = weatherPlaceOf(row);
  // Weather switched off (or configured to somewhere that is not on the globe)
  // is a normal state, not a failure. Nothing is fetched and nothing is
  // recorded — there is no error for a family to be shown.
  if (!place) return { status: 'skipped', reason: 'unconfigured' };

  const entry = await getWeatherCacheEntry(familyId);
  if (!options.force && !shouldRefetchWeather({ place, entry, now })) {
    return { status: 'cached' };
  }

  const result = await fetchWeather(place, { ...options, now });

  if (!result.ok) {
    await recordFailure(familyId, result.error, now);
    return { status: 'failed', error: result.error };
  }

  await db
    .insert(weatherSnapshot)
    .values({
      familyId,
      latitude: place.latitude,
      longitude: place.longitude,
      payload: result.snapshot,
      fetchedAt: now,
      lastError: null,
      lastErrorAt: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: weatherSnapshot.familyId,
      set: {
        latitude: place.latitude,
        longitude: place.longitude,
        payload: result.snapshot,
        fetchedAt: now,
        lastError: null,
        lastErrorAt: null,
        updatedAt: now,
      },
    });

  return { status: 'refreshed' };
}

/**
 * Record why the last attempt failed, without disturbing the reading.
 *
 * The insert branch exists for the household that has never had a successful
 * fetch: there is no payload to protect, so the failure is recorded on the
 * *row* only when one already exists. A first-ever failure writes nothing —
 * an empty row with a `payload` we would have to invent is worse than no row,
 * and `resolveWeatherView` already answers "configured, nothing cached" with
 * `unavailable`.
 */
async function recordFailure(
  familyId: string,
  error: WeatherRefreshFailure,
  now: Date
): Promise<void> {
  await getDb()
    .update(weatherSnapshot)
    .set({ lastError: error, lastErrorAt: now, updatedAt: now })
    .where(eq(weatherSnapshot.familyId, familyId));
}
