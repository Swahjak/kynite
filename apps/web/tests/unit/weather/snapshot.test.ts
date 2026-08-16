import { describe, expect, it } from 'vitest';
import {
  WEATHER_FRESH_MS,
  WEATHER_MAX_AGE_MS,
  WEATHER_REFETCH_AFTER_MS,
  resolveWeatherView,
  sameWeatherPlace,
  shouldRefetchWeather,
  weatherPlaceOf,
  type WeatherCacheEntry,
  type WeatherSnapshot,
} from '@/modules/weather/domain/snapshot';

const NOW = new Date('2026-08-16T12:00:00.000Z');
const PLACE = { latitude: 52.37, longitude: 4.89, label: 'Thuis' };

function snapshotAt(fetchedAt: Date): WeatherSnapshot {
  return {
    place: { ...PLACE, timeZone: 'Europe/Amsterdam' },
    current: {
      observedAt: '2026-08-16T13:45',
      temperatureC: 23.6,
      apparentTemperatureC: 23.3,
      weatherCode: 3,
      isDay: true,
    },
    forecast: [
      { date: '2026-08-16', weatherCode: 3, minTemperatureC: 17.2, maxTemperatureC: 23.6 },
    ],
    fetchedAt: fetchedAt.toISOString(),
  };
}

function entryAgedMs(ageMs: number, overrides: Partial<WeatherCacheEntry> = {}): WeatherCacheEntry {
  const fetchedAt = new Date(NOW.getTime() - ageMs);
  return {
    latitude: PLACE.latitude,
    longitude: PLACE.longitude,
    fetchedAt,
    snapshot: snapshotAt(fetchedAt),
    ...overrides,
  };
}

describe('the cache windows', () => {
  it('orders refetch < fresh < max age', () => {
    expect(WEATHER_REFETCH_AFTER_MS).toBeLessThan(WEATHER_FRESH_MS);
    expect(WEATHER_FRESH_MS).toBeLessThan(WEATHER_MAX_AGE_MS);
  });

  it('keeps a snapshot usable for a full day offline', () => {
    expect(WEATHER_MAX_AGE_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe('weatherPlaceOf', () => {
  it('is null until both coordinates are configured', () => {
    expect(weatherPlaceOf({ latitude: null, longitude: null, label: null })).toBeNull();
    expect(weatherPlaceOf({ latitude: 52.37, longitude: null, label: 'Thuis' })).toBeNull();
    expect(weatherPlaceOf({ latitude: null, longitude: 4.89, label: 'Thuis' })).toBeNull();
  });

  it('reads a configured location, label optional', () => {
    expect(weatherPlaceOf({ latitude: 52.37, longitude: 4.89, label: 'Thuis' })).toEqual(PLACE);
    expect(weatherPlaceOf({ latitude: 52.37, longitude: 4.89, label: null })).toEqual({
      latitude: 52.37,
      longitude: 4.89,
      label: null,
    });
  });

  it('refuses coordinates outside the globe rather than fetching nonsense', () => {
    expect(weatherPlaceOf({ latitude: 91, longitude: 4.89, label: null })).toBeNull();
    expect(weatherPlaceOf({ latitude: 52.37, longitude: 181, label: null })).toBeNull();
    expect(weatherPlaceOf({ latitude: Number.NaN, longitude: 4.89, label: null })).toBeNull();
  });
});

describe('sameWeatherPlace', () => {
  it('ignores differences below the resolution we actually fetch at', () => {
    expect(sameWeatherPlace(PLACE, { latitude: 52.37000004, longitude: 4.89000001 })).toBe(true);
  });

  it('sees a real move', () => {
    expect(sameWeatherPlace(PLACE, { latitude: 51.44, longitude: 5.48 })).toBe(false);
  });

  it('ignores the label — a rename is not a move', () => {
    expect(sameWeatherPlace(PLACE, { ...PLACE, label: 'Oma' })).toBe(true);
  });
});

describe('shouldRefetchWeather (the cache hit/miss decision)', () => {
  it('misses when nothing is cached', () => {
    expect(shouldRefetchWeather({ place: PLACE, entry: null, now: NOW })).toBe(true);
  });

  it('hits while the entry is inside the refetch window', () => {
    const entry = entryAgedMs(WEATHER_REFETCH_AFTER_MS - 1);

    expect(shouldRefetchWeather({ place: PLACE, entry, now: NOW })).toBe(false);
  });

  it('misses once the entry is older than the refetch window', () => {
    const entry = entryAgedMs(WEATHER_REFETCH_AFTER_MS);

    expect(shouldRefetchWeather({ place: PLACE, entry, now: NOW })).toBe(true);
  });

  it('misses when the household moved, however fresh the entry is', () => {
    const entry = entryAgedMs(0, { latitude: 51.44, longitude: 5.48 });

    expect(shouldRefetchWeather({ place: PLACE, entry, now: NOW })).toBe(true);
  });

  it('misses on a clock that jumped backwards rather than trusting a future entry', () => {
    const entry = entryAgedMs(-60 * 60 * 1000);

    expect(shouldRefetchWeather({ place: PLACE, entry, now: NOW })).toBe(true);
  });
});

describe('resolveWeatherView (what the hub is handed)', () => {
  it('is unconfigured when no location is set', () => {
    expect(resolveWeatherView({ place: null, entry: entryAgedMs(0), now: NOW })).toEqual({
      status: 'unconfigured',
    });
  });

  it('is unavailable when configured but never fetched', () => {
    expect(resolveWeatherView({ place: PLACE, entry: null, now: NOW })).toEqual({
      status: 'unavailable',
    });
  });

  it('is fresh inside the fresh window', () => {
    const view = resolveWeatherView({ place: PLACE, entry: entryAgedMs(60_000), now: NOW });

    expect(view.status).toBe('ok');
    expect(view).toMatchObject({ freshness: 'fresh', ageMs: 60_000 });
  });

  it('is stale — but still handed over — past the fresh window', () => {
    const entry = entryAgedMs(WEATHER_FRESH_MS + 1);
    const view = resolveWeatherView({ place: PLACE, entry, now: NOW });

    expect(view).toMatchObject({ status: 'ok', freshness: 'stale' });
    // The reading itself is what a wall display keeps showing while the
    // provider is unreachable; the label is what stops it lying about being now.
    expect(view.status === 'ok' && view.snapshot.current.temperatureC).toBe(23.6);
  });

  it('treats the fresh boundary itself as fresh', () => {
    const view = resolveWeatherView({
      place: PLACE,
      entry: entryAgedMs(WEATHER_FRESH_MS),
      now: NOW,
    });

    expect(view).toMatchObject({ freshness: 'fresh' });
  });

  it('gives up rather than showing yesterday as today', () => {
    const entry = entryAgedMs(WEATHER_MAX_AGE_MS + 1);

    expect(resolveWeatherView({ place: PLACE, entry, now: NOW })).toEqual({
      status: 'unavailable',
    });
  });

  it('does not show another place, however fresh the reading', () => {
    const entry = entryAgedMs(0, { latitude: 51.44, longitude: 5.48 });

    expect(resolveWeatherView({ place: PLACE, entry, now: NOW })).toEqual({
      status: 'unavailable',
    });
  });

  it('reports the configured label, not the one the snapshot was stored with', () => {
    const entry = entryAgedMs(60_000);
    const view = resolveWeatherView({
      place: { ...PLACE, label: 'Oma' },
      entry,
      now: NOW,
    });

    expect(view.status === 'ok' && view.snapshot.place.label).toBe('Oma');
  });
});
