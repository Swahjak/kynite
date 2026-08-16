import { describe, expect, it } from 'vitest';
import { WMO_WEATHER_CODES, type WmoWeatherCode } from '@/modules/weather/domain/snapshot';
import {
  WEATHER_VISUALS,
  WEATHER_VISUAL_SCENES,
  WMO_WEATHER_VISUALS,
  weatherVisualFor,
} from '@/modules/weather/domain/visual';

/**
 * The WMO→visual mapping is the only place in this feature where a wrong
 * answer is *silent*: a code that falls through renders a sun over a
 * thunderstorm, and nothing throws. So the property under test is totality,
 * not a spot-check — every code Open-Meteo can send has a visual, every visual
 * has a card scene, and the two visuals the data can never justify stay
 * unreachable.
 */

describe('WMO code → weather visual', () => {
  it('maps every WMO code the provider can send', () => {
    for (const code of WMO_WEATHER_CODES) {
      const visual = WMO_WEATHER_VISUALS[code];

      expect(WEATHER_VISUALS, `WMO ${code}`).toContain(visual);
    }
  });

  it('covers the code list exactly — no entry for a code that cannot arrive', () => {
    expect(
      Object.keys(WMO_WEATHER_VISUALS)
        .map(Number)
        .sort((a, b) => a - b)
    ).toEqual([...WMO_WEATHER_CODES].sort((a, b) => a - b));
  });

  it('gives every visual a card scene', () => {
    for (const visual of WEATHER_VISUALS) {
      expect(WEATHER_VISUAL_SCENES[visual], visual).toBeTruthy();
    }
  });

  /**
   * Owner decision: wind has no WMO code at all (the code list carries no wind
   * state and `WeatherObservation` no wind field), and hail's only codes —
   * 96/99 — are *thunderstorm with hail*, which is thunder. Both visuals exist
   * because the design sheet draws them; neither may be reachable from data.
   */
  it('never reaches the wind or hail visuals from a WMO code', () => {
    const reachable = new Set(
      WMO_WEATHER_CODES.flatMap((code) => [
        weatherVisualFor({ weatherCode: code, isDay: true }),
        weatherVisualFor({ weatherCode: code, isDay: false }),
      ])
    );

    expect(reachable.has('wind')).toBe(false);
    expect(reachable.has('hail')).toBe(false);
  });

  it('folds freezing drizzle into drizzle and freezing rain into rain', () => {
    expect(WMO_WEATHER_VISUALS[56]).toBe('drizzle');
    expect(WMO_WEATHER_VISUALS[57]).toBe('drizzle');
    expect(WMO_WEATHER_VISUALS[66]).toBe('rain');
    expect(WMO_WEATHER_VISUALS[67]).toBe('rain');
  });

  it('routes thunder-with-hail to thunder, not to hail', () => {
    expect(WMO_WEATHER_VISUALS[95]).toBe('thunder');
    expect(WMO_WEATHER_VISUALS[96]).toBe('thunder');
    expect(WMO_WEATHER_VISUALS[99]).toBe('thunder');
  });
});

describe('day and night', () => {
  /** The sheet draws a night twin for exactly two of the twelve. */
  const NIGHT_TWINS: Partial<Record<WmoWeatherCode, string>> = {
    0: 'clear-night',
    1: 'partly-cloudy-night',
    2: 'partly-cloudy-night',
  };

  it('selects a night visual only for clear and partly-cloudy', () => {
    for (const code of WMO_WEATHER_CODES) {
      const day = weatherVisualFor({ weatherCode: code, isDay: true });
      const night = weatherVisualFor({ weatherCode: code, isDay: false });

      expect(day, `WMO ${code} by day`).toBe(WMO_WEATHER_VISUALS[code]);
      expect(night, `WMO ${code} by night`).toBe(NIGHT_TWINS[code] ?? WMO_WEATHER_VISUALS[code]);
    }
  });

  it('puts both night visuals on the night card scene', () => {
    expect(WEATHER_VISUAL_SCENES['clear-night']).toBe('night');
    expect(WEATHER_VISUAL_SCENES['partly-cloudy-night']).toBe('night');
  });

  it('leaves rain, snow, fog and thunder on their day scene after dark', () => {
    for (const code of [61, 71, 45, 95] as const) {
      const visual = weatherVisualFor({ weatherCode: code, isDay: false });

      expect(WEATHER_VISUAL_SCENES[visual], `WMO ${code}`).not.toBe('night');
    }
  });
});
