import { describe, expect, it, vi } from 'vitest';
import { WEATHER_FETCH_TIMEOUT_MS, fetchWeather } from '@/modules/weather/client';

/**
 * The one place the network is touched. Every case here stubs `fetch` — the
 * real Open-Meteo endpoint is never called from the suite.
 */

const PLACE = { latitude: 52.37, longitude: 4.89, label: 'Thuis' };
const FETCHED_AT = new Date('2026-08-16T11:45:30.000Z');

const BODY = {
  latitude: 52.366,
  longitude: 4.901,
  timezone: 'Europe/Amsterdam',
  current: {
    time: '2026-08-16T13:45',
    temperature_2m: 23.6,
    apparent_temperature: 23.3,
    weather_code: 3,
    is_day: 1,
  },
  daily: {
    time: ['2026-08-16', '2026-08-17'],
    weather_code: [3, 61],
    temperature_2m_max: [23.6, 20.2],
    temperature_2m_min: [17.2, 16.7],
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('fetchWeather', () => {
  it('returns a domain snapshot for a good response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(BODY));

    const result = await fetchWeather(PLACE, { fetchImpl, now: FETCHED_AT, days: 2 });

    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.snapshot.current.temperatureC).toBe(23.6);
    expect(result.ok && result.snapshot.forecast).toHaveLength(2);
    expect(result.ok && result.snapshot.fetchedAt).toBe(FETCHED_AT.toISOString());
  });

  it('calls Open-Meteo once, over https, with no credentials of any kind', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(BODY));

    await fetchWeather(PLACE, { fetchImpl, now: FETCHED_AT, days: 2 });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [target, init] = fetchImpl.mock.calls[0] as unknown as [URL | string, RequestInit];
    const url = new URL(String(target));

    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('api.open-meteo.com');
    expect(init.signal).toBeDefined();
    expect(JSON.stringify(init.headers ?? {})).not.toMatch(/authorization|cookie|api[-_]?key/i);
  });

  it('reports an HTTP error without throwing', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: true, reason: 'nope' }, 503));

    const result = await fetchWeather(PLACE, { fetchImpl, now: FETCHED_AT });

    expect(result).toEqual({ ok: false, error: 'httpError', status: 503 });
  });

  it('reports an unreachable provider without throwing', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });

    const result = await fetchWeather(PLACE, { fetchImpl, now: FETCHED_AT });

    expect(result).toEqual({ ok: false, error: 'unreachable' });
  });

  it('reports a timeout as its own failure, and aborts the request', async () => {
    const fetchImpl = vi.fn(
      (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );

    vi.useFakeTimers();
    try {
      const pending = fetchWeather(PLACE, { fetchImpl, now: FETCHED_AT });
      await vi.advanceTimersByTimeAsync(WEATHER_FETCH_TIMEOUT_MS + 1);
      await expect(pending).resolves.toEqual({ ok: false, error: 'timeout' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a body that is not JSON as an invalid response', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>maintenance</html>', { status: 200 }));

    const result = await fetchWeather(PLACE, { fetchImpl, now: FETCHED_AT });

    expect(result).toEqual({ ok: false, error: 'invalidResponse' });
  });

  it('reports JSON of the wrong shape as an invalid response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ current: { temperature_2m: 'warm' } }));

    const result = await fetchWeather(PLACE, { fetchImpl, now: FETCHED_AT });

    expect(result).toEqual({ ok: false, error: 'invalidResponse' });
  });

  it('refuses an unusable location before it opens a socket', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(BODY));

    const result = await fetchWeather(
      { latitude: 999, longitude: 4.89, label: null },
      { fetchImpl, now: FETCHED_AT }
    );

    expect(result).toEqual({ ok: false, error: 'invalidLocation' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
