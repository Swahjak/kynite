import { describe, expect, it } from 'vitest';
import {
  OPEN_METEO_FORECAST_URL,
  openMeteoUrl,
  parseOpenMeteo,
} from '@/modules/weather/domain/open-meteo';

/**
 * The provider adapter: Open-Meteo's wire shape in, this app's domain out.
 *
 * The body below is a *verbatim* capture of a real
 * `api.open-meteo.com/v1/forecast` response (Amsterdam, 2026-08-16), taken
 * once by hand. Everything else in the suite stubs `fetch`, so this fixture is
 * the only thing standing between the mapper and a provider that quietly
 * renames a field — which is exactly why it is a capture rather than a
 * hand-written object that agrees with the parser by construction.
 */
const LIVE_CAPTURE = {
  latitude: 52.366,
  longitude: 4.901,
  generationtime_ms: 0.274,
  utc_offset_seconds: 7200,
  timezone: 'Europe/Amsterdam',
  timezone_abbreviation: 'GMT+2',
  elevation: 11.0,
  current_units: {
    time: 'iso8601',
    interval: 'seconds',
    temperature_2m: '°C',
    apparent_temperature: '°C',
    weather_code: 'wmo code',
    is_day: '',
  },
  current: {
    time: '2026-08-16T13:45',
    interval: 900,
    temperature_2m: 23.6,
    apparent_temperature: 23.3,
    weather_code: 3,
    is_day: 1,
  },
  daily_units: {
    time: 'iso8601',
    weather_code: 'wmo code',
    temperature_2m_max: '°C',
    temperature_2m_min: '°C',
  },
  daily: {
    time: ['2026-08-16', '2026-08-17', '2026-08-18'],
    weather_code: [3, 61, 51],
    temperature_2m_max: [23.6, 20.2, 20.3],
    temperature_2m_min: [17.2, 16.7, 17.0],
  },
};

const PLACE = { latitude: 52.37, longitude: 4.89, label: 'Thuis' };
const FETCHED_AT = new Date('2026-08-16T11:45:30.000Z');

describe('openMeteoUrl', () => {
  it('asks for exactly the fields the domain model carries', () => {
    const url = new URL(openMeteoUrl(PLACE, 3));

    expect(`${url.origin}${url.pathname}`).toBe(OPEN_METEO_FORECAST_URL);
    expect(url.searchParams.get('latitude')).toBe('52.37');
    expect(url.searchParams.get('longitude')).toBe('4.89');
    expect(url.searchParams.get('current')?.split(',')).toEqual([
      'temperature_2m',
      'apparent_temperature',
      'weather_code',
      'is_day',
    ]);
    expect(url.searchParams.get('daily')?.split(',')).toEqual([
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
    ]);
    expect(url.searchParams.get('forecast_days')).toBe('3');
    // `timezone=auto` is what makes `daily.time` the *location's* calendar days
    // rather than UTC ones — a forecast row labelled "tomorrow" has to mean
    // tomorrow where the family lives.
    expect(url.searchParams.get('timezone')).toBe('auto');
  });

  it('rounds the coordinates it sends', () => {
    const url = new URL(openMeteoUrl({ latitude: 52.3702157, longitude: 4.8951679 }, 3));

    expect(url.searchParams.get('latitude')).toBe('52.3702');
    expect(url.searchParams.get('longitude')).toBe('4.8952');
  });
});

describe('parseOpenMeteo', () => {
  it('maps a real response onto the domain model', () => {
    const snapshot = parseOpenMeteo(LIVE_CAPTURE, { place: PLACE, fetchedAt: FETCHED_AT });

    expect(snapshot).toEqual({
      place: {
        latitude: 52.37,
        longitude: 4.89,
        label: 'Thuis',
        timeZone: 'Europe/Amsterdam',
      },
      current: {
        observedAt: '2026-08-16T13:45',
        temperatureC: 23.6,
        apparentTemperatureC: 23.3,
        weatherCode: 3,
        isDay: true,
      },
      forecast: [
        { date: '2026-08-16', weatherCode: 3, minTemperatureC: 17.2, maxTemperatureC: 23.6 },
        { date: '2026-08-17', weatherCode: 61, minTemperatureC: 16.7, maxTemperatureC: 20.2 },
        { date: '2026-08-18', weatherCode: 51, minTemperatureC: 17.0, maxTemperatureC: 20.3 },
      ],
      fetchedAt: FETCHED_AT.toISOString(),
    });
  });

  it('carries a null label rather than inventing one', () => {
    const snapshot = parseOpenMeteo(LIVE_CAPTURE, {
      place: { latitude: 52.37, longitude: 4.89 },
      fetchedAt: FETCHED_AT,
    });

    expect(snapshot?.place.label).toBeNull();
  });

  it('rejects a body that is not an Open-Meteo response', () => {
    expect(parseOpenMeteo({ hello: 'world' }, { place: PLACE, fetchedAt: FETCHED_AT })).toBeNull();
    expect(parseOpenMeteo('<html>503</html>', { place: PLACE, fetchedAt: FETCHED_AT })).toBeNull();
    expect(parseOpenMeteo(null, { place: PLACE, fetchedAt: FETCHED_AT })).toBeNull();
  });

  it('rejects a response whose daily arrays disagree in length', () => {
    const ragged = {
      ...LIVE_CAPTURE,
      daily: { ...LIVE_CAPTURE.daily, temperature_2m_min: [17.2] },
    };

    expect(parseOpenMeteo(ragged, { place: PLACE, fetchedAt: FETCHED_AT })).toBeNull();
  });

  it('rejects a response with a non-numeric temperature', () => {
    const wrong = {
      ...LIVE_CAPTURE,
      current: { ...LIVE_CAPTURE.current, temperature_2m: 'warm' },
    };

    expect(parseOpenMeteo(wrong, { place: PLACE, fetchedAt: FETCHED_AT })).toBeNull();
  });

  it('rejects a WMO code outside the code table', () => {
    const wrong = { ...LIVE_CAPTURE, current: { ...LIVE_CAPTURE.current, weather_code: 4711 } };

    expect(parseOpenMeteo(wrong, { place: PLACE, fetchedAt: FETCHED_AT })).toBeNull();
  });

  it('tolerates a missing apparent temperature', () => {
    const { apparent_temperature: _dropped, ...current } = LIVE_CAPTURE.current;
    const snapshot = parseOpenMeteo(
      { ...LIVE_CAPTURE, current },
      { place: PLACE, fetchedAt: FETCHED_AT }
    );

    expect(snapshot?.current.apparentTemperatureC).toBeNull();
    expect(snapshot?.current.temperatureC).toBe(23.6);
  });

  it('falls back to UTC when the provider omits the zone', () => {
    const { timezone: _dropped, ...rest } = LIVE_CAPTURE;
    const snapshot = parseOpenMeteo(rest, { place: PLACE, fetchedAt: FETCHED_AT });

    expect(snapshot?.place.timeZone).toBe('UTC');
  });
});
