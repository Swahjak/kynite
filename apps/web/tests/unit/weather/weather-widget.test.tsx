import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WeatherSnapshot, WeatherView } from '@/modules/weather';

/**
 * The widget draws exactly one of the four `WeatherView` states.
 *
 * `unconfigured` and `unavailable` are **deliberately undesigned** — neither
 * refreshed export draws an empty state, an error card or a "stel een locatie
 * in" affordance for weather, so the honest rendering of both is nothing at
 * all. This test is what stops a later change from inventing one by accident.
 *
 * `stale` renders exactly like `fresh` for the same reason: the design has no
 * age label and no dimmed treatment, and a widget that invented one would be
 * saying something the design never said.
 */

vi.mock('server-only', () => ({}));

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => {
    const t = (key: string) => `${namespace}.${key}`;
    return Object.assign(t, { rich: t, markup: t, raw: t, has: () => true });
  },
  getFormatter: async () => ({
    number: (value: number) => String(value),
  }),
}));

const { WeatherWidget } = await import('@/modules/weather/ui/weather-widget');

const SNAPSHOT: WeatherSnapshot = {
  place: {
    latitude: 52.0907,
    longitude: 5.1214,
    label: 'Utrecht',
    timeZone: 'Europe/Amsterdam',
  },
  current: {
    observedAt: '2026-08-15T14:00',
    temperatureC: 21.4,
    apparentTemperatureC: 20.1,
    weatherCode: 2,
    isDay: true,
  },
  forecast: [
    { date: '2026-08-15', weatherCode: 2, minTemperatureC: 13.8, maxTemperatureC: 23.2 },
    { date: '2026-08-16', weatherCode: 61, minTemperatureC: 12.0, maxTemperatureC: 19.0 },
  ],
  fetchedAt: '2026-08-15T12:05:00.000Z',
};

async function renderWidget(view: WeatherView) {
  render(await WeatherWidget({ view }));
}

describe('WeatherWidget', () => {
  it('renders nothing when no location is configured', async () => {
    const { container } = render(await WeatherWidget({ view: { status: 'unconfigured' } }));

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when there is no usable reading', async () => {
    const { container } = render(await WeatherWidget({ view: { status: 'unavailable' } }));

    expect(container).toBeEmptyDOMElement();
  });

  it('draws the reading when there is one', async () => {
    await renderWidget({ status: 'ok', freshness: 'fresh', ageMs: 0, snapshot: SNAPSHOT });

    // Rounded to whole degrees, as every temperature in the sheet is.
    expect(screen.getByText('21°')).toBeInTheDocument();
    expect(screen.getByText('weather.condition.partly-cloudy')).toBeInTheDocument();
    expect(screen.getByText(/Utrecht/)).toBeInTheDocument();
    expect(screen.getByText(/23° \/ 14°/)).toBeInTheDocument();
  });

  it('draws a stale reading exactly like a fresh one — the design has no stale state', async () => {
    const { container: fresh } = render(
      await WeatherWidget({
        view: { status: 'ok', freshness: 'fresh', ageMs: 0, snapshot: SNAPSHOT },
      })
    );
    const { container: stale } = render(
      await WeatherWidget({
        view: {
          status: 'ok',
          freshness: 'stale',
          ageMs: 6 * 60 * 60 * 1000,
          snapshot: SNAPSHOT,
        },
      })
    );

    expect(stale.innerHTML).toBe(fresh.innerHTML);
  });

  it('drops the place from the meta line when the household never named one', async () => {
    await renderWidget({
      status: 'ok',
      freshness: 'fresh',
      ageMs: 0,
      snapshot: { ...SNAPSHOT, place: { ...SNAPSHOT.place, label: null } },
    });

    expect(screen.getByText('23° / 14°')).toBeInTheDocument();
  });
});
