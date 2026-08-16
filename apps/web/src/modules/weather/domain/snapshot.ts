/**
 * The weather domain: what a reading *is*, and how old it is allowed to be.
 *
 * Pure and framework-free (modules/README §2), and deliberately
 * presentation-agnostic. There is no icon name here, no colour class and no
 * translated string — a WMO code, temperatures, dates and a freshness label.
 * The mapping from WMO code to an icon, and from `freshness: 'stale'` to
 * whatever the wall says about it, belongs to the UI layer and to `messages/`;
 * putting either here would make the data layer own a design decision that has
 * not been made yet.
 *
 * ## WMO 4677 weather codes
 *
 * Open-Meteo reports conditions as a WMO 4677 code, and that integer is the
 * only condition field this model carries:
 *
 * | code | meaning |
 * | --- | --- |
 * | 0 | clear sky |
 * | 1, 2, 3 | mainly clear, partly cloudy, overcast |
 * | 45, 48 | fog, depositing rime fog |
 * | 51, 53, 55 | drizzle: light, moderate, dense |
 * | 56, 57 | freezing drizzle: light, dense |
 * | 61, 63, 65 | rain: slight, moderate, heavy |
 * | 66, 67 | freezing rain: light, heavy |
 * | 71, 73, 75 | snowfall: slight, moderate, heavy |
 * | 77 | snow grains |
 * | 80, 81, 82 | rain showers: slight, moderate, violent |
 * | 85, 86 | snow showers: slight, heavy |
 * | 95 | thunderstorm |
 * | 96, 99 | thunderstorm with slight / heavy hail |
 *
 * A future icon map covers those buckets; `WMO_WEATHER_CODES` below is the
 * same list as data, so the mapping can be exhaustive rather than guessed.
 */

/** Every code Open-Meteo can return. Anything else is a response we do not trust. */
export const WMO_WEATHER_CODES = [
  0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86,
  95, 96, 99,
] as const;

export type WmoWeatherCode = (typeof WMO_WEATHER_CODES)[number];

export function isWmoWeatherCode(value: number): value is WmoWeatherCode {
  return (WMO_WEATHER_CODES as readonly number[]).includes(value);
}

/**
 * Where the reading is for. `label` is the household's own word for it
 * ("Thuis", "Oma") — never geocoded, never derived, and null until somebody
 * types one.
 */
export type WeatherPlaceConfig = {
  latitude: number;
  longitude: number;
  label?: string | null;
};

export type WeatherPlace = {
  latitude: number;
  longitude: number;
  label: string | null;
  /** The IANA zone the provider resolved for the coordinates; `forecast` dates are in it. */
  timeZone: string;
};

export type WeatherObservation = {
  /** Local wall time at the location, as the provider reported it (`YYYY-MM-DDTHH:mm`). */
  observedAt: string;
  temperatureC: number;
  /** "Feels like". Null when the provider did not report one. */
  apparentTemperatureC: number | null;
  weatherCode: WmoWeatherCode;
  isDay: boolean;
};

export type WeatherDay = {
  /** `YYYY-MM-DD` in `place.timeZone`. Index 0 is today at the location. */
  date: string;
  weatherCode: WmoWeatherCode;
  minTemperatureC: number;
  maxTemperatureC: number;
};

export type WeatherSnapshot = {
  place: WeatherPlace;
  current: WeatherObservation;
  forecast: WeatherDay[];
  /** When *we* retrieved it, ISO-8601 UTC. Freshness is measured from here. */
  fetchedAt: string;
};

/** A stored snapshot plus the coordinates it was actually fetched for. */
export type WeatherCacheEntry = {
  latitude: number;
  longitude: number;
  fetchedAt: Date;
  snapshot: WeatherSnapshot;
};

export type WeatherFreshness = 'fresh' | 'stale';

/**
 * What a caller (today: the future hub widget) is handed. Four states, and the
 * separation is the point — "no location configured" and "the provider has
 * been down for a day" are different sentences, and a UI that cannot tell them
 * apart will show the wrong one.
 */
export type WeatherView =
  | { status: 'unconfigured' }
  | { status: 'unavailable' }
  | {
      status: 'ok';
      freshness: WeatherFreshness;
      /** How old the reading is, in ms. Lets the UI say "3 hours ago" without re-deriving it. */
      ageMs: number;
      snapshot: WeatherSnapshot;
    };

/** How many days the forecast covers, today included. */
export const WEATHER_FORECAST_DAYS = 3;

/**
 * Three windows, and each answers a different question.
 *
 * - **`WEATHER_REFETCH_AFTER_MS` — may we call the provider?** 25 minutes.
 *   Open-Meteo is free and asks for courtesy, not a key; the half-hourly sweep
 *   (`queues.ts`) is just outside this, so every sweep does one call per
 *   household and anything extra in between (a location change, a second
 *   worker) is a cache hit rather than a second call.
 * - **`WEATHER_FRESH_MS` — is the reading still "now"?** 90 minutes: three
 *   sweeps' worth of tolerance, so a single missed job does not flip a wall
 *   display into a stale label for something the family would not notice.
 * - **`WEATHER_MAX_AGE_MS` — is it still worth showing at all?** 24 hours.
 *   Past a day the reading is not weather any more, it is a memory, and a
 *   kitchen wall confidently showing yesterday's rain is worse than showing
 *   nothing. This is the boundary between "stale but labelled" (good) and
 *   "wrong" (never).
 */
export const WEATHER_REFETCH_AFTER_MS = 25 * 60 * 1000;
export const WEATHER_FRESH_MS = 90 * 60 * 1000;
export const WEATHER_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * The precision coordinates are compared and fetched at: 4 decimals, ~11 m.
 * Far finer than any weather model, and it makes "did the household move?" a
 * stable integer question rather than a float comparison.
 */
const COORDINATE_DECIMALS = 4;

export function roundCoordinate(value: number): number {
  const factor = 10 ** COORDINATE_DECIMALS;
  return Math.round(value * factor) / factor;
}

/**
 * The stored configuration, validated into a usable place — or null.
 *
 * Null is the "weather is off" state, and it is the default for every
 * household: the app ships with no location, exactly as it ships with no
 * Google credentials, because guessing a city for a family is worse than
 * showing nothing until they say where they live.
 */
export function weatherPlaceOf(input: {
  latitude: number | null;
  longitude: number | null;
  label: string | null;
}): WeatherPlaceConfig | null {
  const { latitude, longitude } = input;

  if (latitude === null || longitude === null) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  return {
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude),
    label: input.label,
  };
}

/** Same spot, to the resolution we fetch at. The label is not part of the identity. */
export function sameWeatherPlace(
  a: { latitude: number; longitude: number; label?: string | null },
  b: { latitude: number; longitude: number; label?: string | null }
): boolean {
  return (
    roundCoordinate(a.latitude) === roundCoordinate(b.latitude) &&
    roundCoordinate(a.longitude) === roundCoordinate(b.longitude)
  );
}

function ageMsOf(entry: WeatherCacheEntry, now: Date): number {
  return now.getTime() - entry.fetchedAt.getTime();
}

/**
 * The cache decision, and the only thing that may authorise a network call.
 *
 * A negative age (an entry stamped in the future — a clock that jumped, a
 * restored backup) counts as a miss rather than as infinitely fresh, because
 * the alternative is a hub that never refreshes again.
 */
export function shouldRefetchWeather(input: {
  place: WeatherPlaceConfig;
  entry: WeatherCacheEntry | null;
  now: Date;
}): boolean {
  const { entry, now, place } = input;

  if (!entry) return true;
  if (!sameWeatherPlace(place, entry)) return true;

  const age = ageMsOf(entry, now);
  return age < 0 || age >= WEATHER_REFETCH_AFTER_MS;
}

/**
 * The read path's whole policy, as one pure function.
 *
 * **Stale-but-labelled beats an error.** A cached reading inside 24 hours is
 * always handed over, with `freshness: 'stale'` and its age, whatever the
 * provider is doing right now — the hub is a wall display that must keep
 * working with no network at all, so "the last thing we knew, and when we knew
 * it" is the honest answer. Only two things suppress it: a snapshot older than
 * a day, and a snapshot for somewhere else.
 */
export function resolveWeatherView(input: {
  place: WeatherPlaceConfig | null;
  entry: WeatherCacheEntry | null;
  now: Date;
}): WeatherView {
  const { entry, now, place } = input;

  if (!place) return { status: 'unconfigured' };
  if (!entry) return { status: 'unavailable' };
  if (!sameWeatherPlace(place, entry)) return { status: 'unavailable' };

  // A future-stamped entry is shown as brand new rather than discarded: the
  // reading is real, only the clock disagrees, and clamping is what keeps a
  // skewed hub showing weather instead of a blank.
  const ageMs = Math.max(0, ageMsOf(entry, now));
  if (ageMs > WEATHER_MAX_AGE_MS) return { status: 'unavailable' };

  return {
    status: 'ok',
    freshness: ageMs <= WEATHER_FRESH_MS ? 'fresh' : 'stale',
    ageMs,
    // The label follows the *current* configuration, not the copy frozen into
    // the stored snapshot: renaming "Thuis" must not wait for a refresh.
    snapshot: { ...entry.snapshot, place: { ...entry.snapshot.place, label: place.label ?? null } },
  };
}
