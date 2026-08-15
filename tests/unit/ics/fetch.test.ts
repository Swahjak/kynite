import { describe, expect, it, vi } from 'vitest';
import { MAX_FEED_BYTES, fetchFeed } from '@/modules/ics/fetch';

/**
 * The network half of the SSRF guard (M25).
 *
 * `domain/url.ts` is tested on strings; this file tests the two rules that only
 * exist once a request is in flight — *every redirect hop is re-validated*, and
 * *the address DNS returns is what gets checked*, not the hostname. Both are
 * driven through the injected `fetchImpl`/`resolveHost` seams rather than a
 * real socket, which is what lets them run in the unit gate.
 */

const CALENDAR = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR';

function ok(body = CALENDAR, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/calendar', ...headers },
  });
}

const publicDns = async () => ['93.184.216.34'];

describe('fetchFeed', () => {
  it('fetches a public feed and returns its validators', async () => {
    const fetchImpl = vi.fn(async () => ok(CALENDAR, { etag: 'W/"abc"', 'last-modified': 'Mon' }));

    const result = await fetchFeed('https://school.example/a.ics', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolveHost: publicDns,
    });

    expect(result).toMatchObject({
      ok: true,
      notModified: false,
      etag: 'W/"abc"',
      lastModified: 'Mon',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('sends the conditional headers and reports a 304 without a body', async () => {
    const fetchImpl = vi.fn(async (_url: unknown, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      expect(headers['if-none-match']).toBe('W/"abc"');
      expect(headers['if-modified-since']).toBe('Mon');
      return new Response(null, { status: 304 });
    });

    const result = await fetchFeed('https://school.example/a.ics', {
      etag: 'W/"abc"',
      lastModified: 'Mon',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolveHost: publicDns,
    });

    expect(result).toMatchObject({ ok: true, notModified: true, body: null });
  });

  it('refuses a hostname that resolves into a private range', async () => {
    const fetchImpl = vi.fn(async () => ok());

    const result = await fetchFeed('https://school.example/a.ics', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      // The classic bypass: a perfectly public name with an A record pointing
      // at the loopback (or the cloud metadata address).
      resolveHost: async () => ['169.254.169.254'],
    });

    expect(result).toEqual({ ok: false, error: 'urlPrivateHost' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses when any one of several records is private', async () => {
    const result = await fetchFeed('https://school.example/a.ics', {
      fetchImpl: (async () => ok()) as unknown as typeof fetch,
      resolveHost: async () => ['93.184.216.34', '::1'],
    });

    expect(result).toEqual({ ok: false, error: 'urlPrivateHost' });
  });

  it('re-validates every redirect hop', async () => {
    const fetchImpl = vi.fn(async (url: URL) =>
      url.toString() === 'https://school.example/a.ics'
        ? new Response(null, { status: 302, headers: { location: 'https://metadata.example/x' } })
        : ok()
    );

    const result = await fetchFeed('https://school.example/a.ics', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolveHost: async (hostname) =>
        hostname === 'metadata.example' ? ['169.254.169.254'] : ['93.184.216.34'],
    });

    // The redirect target's *address* is what refuses it — the URL itself is a
    // perfectly ordinary https link.
    expect(result).toEqual({ ok: false, error: 'urlPrivateHost' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('refuses a redirect that changes scheme to http', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(null, { status: 301, headers: { location: 'http://school.example/a.ics' } })
    );

    const result = await fetchFeed('https://school.example/a.ics', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolveHost: publicDns,
    });

    expect(result).toEqual({ ok: false, error: 'urlScheme' });
  });

  it('follows a relative redirect and stops after three hops', async () => {
    const fetchImpl = vi.fn(async (url: URL) =>
      url.pathname === '/final'
        ? ok()
        : new Response(null, { status: 302, headers: { location: `${url.pathname}x` } })
    );

    const result = await fetchFeed('https://school.example/a', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      resolveHost: publicDns,
    });

    expect(result).toEqual({ ok: false, error: 'tooManyRedirects' });
    // The initial request plus three hops, and not a fifth.
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('refuses a body larger than the cap, by content-length and by stream', async () => {
    const declared = await fetchFeed('https://school.example/a.ics', {
      fetchImpl: (async () =>
        ok(CALENDAR, { 'content-length': String(MAX_FEED_BYTES + 1) })) as unknown as typeof fetch,
      resolveHost: publicDns,
    });
    expect(declared).toEqual({ ok: false, error: 'tooLarge' });

    const streamed = await fetchFeed('https://school.example/a.ics', {
      fetchImpl: (async () =>
        ok(`BEGIN:VCALENDAR\r\n${'X'.repeat(MAX_FEED_BYTES + 10)}`)) as unknown as typeof fetch,
      resolveHost: publicDns,
    });
    expect(streamed).toEqual({ ok: false, error: 'tooLarge' });
  });

  it('refuses a body that is not a calendar, whatever the content type claimed', async () => {
    const result = await fetchFeed('https://school.example/a.ics', {
      fetchImpl: (async () => ok('<!doctype html><p>404')) as unknown as typeof fetch,
      resolveHost: publicDns,
    });

    expect(result).toEqual({ ok: false, error: 'notCalendar' });
  });

  it('accepts text/plain, which is how schools really serve feeds', async () => {
    const result = await fetchFeed('https://school.example/a.ics', {
      fetchImpl: (async () =>
        new Response(CALENDAR, {
          status: 200,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        })) as unknown as typeof fetch,
      resolveHost: publicDns,
    });

    expect(result).toMatchObject({ ok: true, notModified: false });
  });

  it('reports an HTTP error and an unreachable host distinctly', async () => {
    const failed = await fetchFeed('https://school.example/a.ics', {
      fetchImpl: (async () => new Response('nope', { status: 503 })) as unknown as typeof fetch,
      resolveHost: publicDns,
    });
    expect(failed).toMatchObject({ ok: false, error: 'httpError', status: 503 });

    const unreachable = await fetchFeed('https://school.example/a.ics', {
      fetchImpl: (async () => {
        throw new TypeError('connect ECONNREFUSED');
      }) as unknown as typeof fetch,
      resolveHost: publicDns,
    });
    expect(unreachable).toEqual({ ok: false, error: 'unreachable' });

    const noDns = await fetchFeed('https://school.example/a.ics', {
      fetchImpl: (async () => ok()) as unknown as typeof fetch,
      resolveHost: async () => {
        throw new Error('ENOTFOUND');
      },
    });
    expect(noDns).toEqual({ ok: false, error: 'unreachable' });
  });
});
