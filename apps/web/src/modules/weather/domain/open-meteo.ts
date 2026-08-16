import { z } from 'zod';
import {
  WEATHER_FORECAST_DAYS,
  isWmoWeatherCode,
  roundCoordinate,
  type WeatherDay,
  type WeatherPlaceConfig,
  type WeatherSnapshot,
} from './snapshot';

/**
 * Open-Meteo's wire format, and nothing else in the app knows it exists.
 *
 * Pure: a URL builder and a parser over `unknown`. The network call itself is
 * `../client.ts`, so every shape the provider can send — including the ones it
 * should not — is testable without a socket.
 *
 * **Why Open-Meteo**: no API key, no account, free for non-commercial use, and
 * the ECMWF/DWD models behind it cover the Netherlands at 1–2 km. The absence
 * of a key is what keeps this feature out of `server/env.ts` entirely.
 *
 * **The parser is the trust boundary.** Anything that is not exactly the shape
 * below returns `null`, and a `null` never reaches the cache — see
 * `../refresh.ts`, where a garbage response leaves the last good snapshot
 * untouched. A free public endpoint that starts serving an HTML maintenance
 * page must not be able to blank a family's wall display.
 */

export const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

/** The `current=` fields, in the order the tests assert and the URL sends. */
export const OPEN_METEO_CURRENT_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'weather_code',
  'is_day',
] as const;

/** The `daily=` fields. Min/max plus the day's representative code — enough for a strip. */
export const OPEN_METEO_DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
] as const;

export function openMeteoUrl(
  place: WeatherPlaceConfig,
  days: number = WEATHER_FORECAST_DAYS
): string {
  const url = new URL(OPEN_METEO_FORECAST_URL);

  url.searchParams.set('latitude', String(roundCoordinate(place.latitude)));
  url.searchParams.set('longitude', String(roundCoordinate(place.longitude)));
  url.searchParams.set('current', OPEN_METEO_CURRENT_FIELDS.join(','));
  url.searchParams.set('daily', OPEN_METEO_DAILY_FIELDS.join(','));
  url.searchParams.set('forecast_days', String(days));
  // `auto` resolves the zone from the coordinates, which is what makes
  // `daily.time` the location's own calendar days. Without it the day
  // boundaries are UTC and "tomorrow" is wrong for half the evening.
  url.searchParams.set('timezone', 'auto');

  return url.toString();
}

/** A WMO code as the provider sends it: an integer, and one we recognise. */
const wmoCode = z.number().int().refine(isWmoWeatherCode, 'unknown WMO weather code');

const currentSchema = z.object({
  time: z.string().min(1),
  temperature_2m: z.number(),
  // Absent on some model/parameter combinations; the domain carries null.
  apparent_temperature: z.number().nullish(),
  weather_code: wmoCode,
  // Documented as 0/1 rather than a boolean.
  is_day: z.number().int().nullish(),
});

const dailySchema = z.object({
  time: z.array(z.string().min(1)),
  weather_code: z.array(wmoCode),
  temperature_2m_max: z.array(z.number()),
  temperature_2m_min: z.array(z.number()),
});

const responseSchema = z.object({
  /** Absent only if we ever drop `timezone=auto`; UTC is the honest fallback. */
  timezone: z.string().min(1).nullish(),
  current: currentSchema,
  daily: dailySchema,
});

/**
 * A response body, made into a snapshot — or `null` if it was not one.
 *
 * The ragged-array check is not paranoia: Open-Meteo returns `daily` as four
 * parallel arrays, so a truncated payload parses field-by-field and only
 * disagrees on length. Zipping that silently would produce a forecast day with
 * an `undefined` temperature, typed as a number.
 */
export function parseOpenMeteo(
  raw: unknown,
  input: { place: WeatherPlaceConfig; fetchedAt: Date }
): WeatherSnapshot | null {
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) return null;

  const { current, daily, timezone } = parsed.data;

  const length = daily.time.length;
  if (
    daily.weather_code.length !== length ||
    daily.temperature_2m_max.length !== length ||
    daily.temperature_2m_min.length !== length
  ) {
    return null;
  }

  const forecast: WeatherDay[] = daily.time.map((date, index) => ({
    date,
    weatherCode: daily.weather_code[index]!,
    minTemperatureC: daily.temperature_2m_min[index]!,
    maxTemperatureC: daily.temperature_2m_max[index]!,
  }));

  return {
    place: {
      // The *configured* coordinates, not the grid point Open-Meteo snapped to:
      // the household said where it lives, and the cache is keyed on that.
      latitude: roundCoordinate(input.place.latitude),
      longitude: roundCoordinate(input.place.longitude),
      label: input.place.label ?? null,
      timeZone: timezone ?? 'UTC',
    },
    current: {
      observedAt: current.time,
      temperatureC: current.temperature_2m,
      apparentTemperatureC: current.apparent_temperature ?? null,
      weatherCode: current.weather_code,
      isDay: (current.is_day ?? 1) === 1,
    },
    forecast,
    fetchedAt: input.fetchedAt.toISOString(),
  };
}
