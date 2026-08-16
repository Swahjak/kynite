import 'server-only';
import { openMeteoUrl, parseOpenMeteo } from './domain/open-meteo';
import {
  WEATHER_FORECAST_DAYS,
  weatherPlaceOf,
  type WeatherPlaceConfig,
  type WeatherSnapshot,
} from './domain/snapshot';

/**
 * The one place Open-Meteo is called.
 *
 * Modelled on `modules/ics/fetch.ts`, minus the SSRF machinery: the host is a
 * constant we chose, not a URL a parent typed, so there is nothing to validate
 * about where the request goes. What is kept is the part that matters for a
 * wall display — **this function never throws**. A provider that is down, slow
 * or serving nonsense is an ordinary, expected state of a free public API, and
 * it is reported as a value so the caller can leave the cache exactly where it
 * is.
 */

/** 8 s. A worker waiting on somebody else's free API is a worker not doing anything else. */
export const WEATHER_FETCH_TIMEOUT_MS = 8_000;

export type WeatherFetchFailure =
  /** The configured coordinates are not a place. Refused before any socket opens. */
  | 'invalidLocation'
  | 'unreachable'
  | 'timeout'
  | 'httpError'
  /** Reached, answered, and the answer was not an Open-Meteo forecast. */
  | 'invalidResponse';

export type WeatherFetchResult =
  | { ok: true; snapshot: WeatherSnapshot }
  | { ok: false; error: WeatherFetchFailure; status?: number };

export type WeatherFetchOptions = {
  /** Injected by the tests; production uses the platform `fetch`. */
  fetchImpl?: typeof fetch;
  /** Injected by the tests; production stamps the wall clock. */
  now?: Date;
  days?: number;
  timeoutMs?: number;
};

export async function fetchWeather(
  place: WeatherPlaceConfig,
  options: WeatherFetchOptions = {}
): Promise<WeatherFetchResult> {
  const checked = weatherPlaceOf({
    latitude: place.latitude,
    longitude: place.longitude,
    label: place.label ?? null,
  });
  if (!checked) return { ok: false, error: 'invalidLocation' };

  const doFetch = options.fetchImpl ?? fetch;
  const fetchedAt = options.now ?? new Date();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? WEATHER_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await doFetch(openMeteoUrl(checked, options.days ?? WEATHER_FORECAST_DAYS), {
      method: 'GET',
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': 'Kynite/1.0 (+family hub weather)' },
      // Open-Meteo is cached by us, in Postgres, with an explicit age. A second
      // opaque cache in front of it would make `fetchedAt` a lie.
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: controller.signal.aborted ? 'timeout' : 'unreachable' };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) return { ok: false, error: 'httpError', status: response.status };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: 'invalidResponse' };
  }

  const snapshot = parseOpenMeteo(body, { place: checked, fetchedAt });
  if (!snapshot) return { ok: false, error: 'invalidResponse' };

  return { ok: true, snapshot };
}
