import { describe, expect, it } from 'vitest';
import {
  checkFeedUrl,
  hostnameAsAddress,
  isBlockedAddress,
  looksLikeCalendar,
  redactFeedUrl,
} from '@/modules/ics/domain/url';

/**
 * The SSRF guard, rule by rule (M25).
 *
 * Every branch of `domain/url.ts` gets a test here because this is the file
 * standing between "a parent pastes a link" and "the server fetches whatever
 * that link says". A regression in any single rule is a working SSRF, not a
 * cosmetic bug — so the coverage is deliberately exhaustive rather than
 * representative.
 */

describe('checkFeedUrl', () => {
  it('accepts a plain https feed', () => {
    const result = checkFeedUrl('https://school.example/agenda.ics');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url.toString()).toBe('https://school.example/agenda.ics');
  });

  it('rewrites webcal:// and webcals:// to https', () => {
    for (const input of ['webcal://school.example/a.ics', 'webcals://school.example/a.ics']) {
      const result = checkFeedUrl(input);
      expect(result.ok, input).toBe(true);
      if (result.ok) expect(result.url.protocol).toBe('https:');
    }
  });

  it('preserves the path and query through the rewrite', () => {
    const result = checkFeedUrl('webcal://school.example/feed?token=abc123&x=1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url.pathname).toBe('/feed');
      expect(result.url.searchParams.get('token')).toBe('abc123');
    }
  });

  it('refuses http:// rather than silently upgrading it', () => {
    expect(checkFeedUrl('http://school.example/a.ics')).toEqual({
      ok: false,
      error: 'urlScheme',
    });
  });

  it.each([
    'file:///etc/passwd',
    'ftp://school.example/a.ics',
    'gopher://x/1',
    'data:text/plain,x',
  ])('refuses the %s scheme', (input) => {
    const result = checkFeedUrl(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(['urlScheme', 'urlInvalid']).toContain(result.error);
  });

  it('refuses credentials in the URL', () => {
    expect(checkFeedUrl('https://user:secret@school.example/a.ics')).toEqual({
      ok: false,
      error: 'urlCredentials',
    });
    expect(checkFeedUrl('https://user@school.example/a.ics')).toEqual({
      ok: false,
      error: 'urlCredentials',
    });
  });

  it.each([
    'https://127.0.0.1/a.ics',
    'https://127.1.2.3/a.ics',
    'https://10.0.0.5/a.ics',
    'https://172.16.4.4/a.ics',
    'https://192.168.1.1/a.ics',
    'https://169.254.169.254/latest/meta-data',
    'https://0.0.0.0/a.ics',
    'https://100.64.0.1/a.ics',
    'https://[::1]/a.ics',
    'https://[fc00::1]/a.ics',
    'https://[fe80::1]/a.ics',
    'https://[::ffff:127.0.0.1]/a.ics',
  ])('refuses the private/reserved literal %s', (input) => {
    expect(checkFeedUrl(input)).toEqual({ ok: false, error: 'urlPrivateHost' });
  });

  it('allows a public literal address', () => {
    expect(checkFeedUrl('https://93.184.216.34/a.ics').ok).toBe(true);
  });

  it('refuses an empty or unparseable value', () => {
    expect(checkFeedUrl('   ')).toEqual({ ok: false, error: 'urlInvalid' });
    expect(checkFeedUrl('not a url')).toEqual({ ok: false, error: 'urlInvalid' });
  });

  it('refuses an absurdly long link before parsing it', () => {
    expect(checkFeedUrl(`https://school.example/${'a'.repeat(3000)}`)).toEqual({
      ok: false,
      error: 'urlTooLong',
    });
  });

  it('does not resolve host names — that is the fetcher’s job', () => {
    // `localhost` is a *name*; the address check that catches it happens after
    // DNS resolution in `fetch.ts`, which is what this asserts is still true.
    expect(checkFeedUrl('https://localhost/a.ics').ok).toBe(true);
  });
});

describe('hostnameAsAddress', () => {
  it('unwraps a bracketed IPv6 literal', () => {
    expect(hostnameAsAddress('[::1]')).toBe('::1');
  });

  it('recognises a dotted-quad literal', () => {
    expect(hostnameAsAddress('192.168.0.1')).toBe('192.168.0.1');
  });

  it('returns null for a host name', () => {
    expect(hostnameAsAddress('school.example')).toBeNull();
    expect(hostnameAsAddress('192.168.0.1.example.com')).toBeNull();
  });
});

describe('isBlockedAddress', () => {
  it.each([
    '0.0.0.0',
    '0.1.2.3',
    '10.255.255.254',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '100.64.0.1',
    '192.0.0.1',
    '192.0.2.5',
    '198.18.0.1',
    '198.51.100.7',
    '203.0.113.9',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1%eth0',
    '::ffff:10.0.0.1',
    '::ffff:7f00:1',
    'not-an-address',
    '',
  ])('blocks %s', (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(['1.1.1.1', '93.184.216.34', '172.32.0.1', '172.15.255.255', '2606:4700::1111'])(
    'allows the public address %s',
    (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    }
  );
});

describe('redactFeedUrl', () => {
  // Every token here is fake; a real one grants read access to a school agenda.
  const SOCIAL_SCHOOLS =
    'https://api.socialschools.eu/api/v1/icalfeed/?schoolId=42&roleTypeId=3' +
    '&userId=00000000-0000-4000-8000-000000000000&hash=faketoken0000abcd';

  it('keeps the host and drops the path and the query', () => {
    const redacted = redactFeedUrl(SOCIAL_SCHOOLS);

    expect(redacted).toContain('api.socialschools.eu');
    expect(redacted).not.toContain('faketoken0000abcd');
    expect(redacted).not.toContain('hash=');
    expect(redacted).not.toContain('00000000-0000-4000-8000-000000000000');
    expect(redacted).not.toContain('icalfeed');
  });

  it('keeps a short tail so two feeds from one school stay distinguishable', () => {
    const a = redactFeedUrl(SOCIAL_SCHOOLS);
    const b = redactFeedUrl(SOCIAL_SCHOOLS.replace('faketoken0000abcd', 'faketoken0000wxyz'));

    expect(a).not.toBe(b);
    expect(a).toBe('api.socialschools.eu/…abcd');
  });

  it('redacts a token that lives in the path rather than the query', () => {
    expect(redactFeedUrl('https://school.example/ical/9f3b7c2d1e5a')).toBe('school.example/…1e5a');
  });

  it('says nothing but the host when there is nothing after it', () => {
    expect(redactFeedUrl('https://school.example/')).toBe('school.example');
    expect(redactFeedUrl('https://school.example')).toBe('school.example');
  });

  it('never returns the input for an unparseable value', () => {
    expect(redactFeedUrl('not a url with a secret=abc')).toBe('…');
    expect(redactFeedUrl('')).toBe('…');
  });

  it('drops credentials rather than echoing them', () => {
    expect(redactFeedUrl('https://user:hunter2@school.example/a.ics')).not.toContain('hunter2');
  });
});

describe('looksLikeCalendar', () => {
  it('accepts a calendar whatever the content type said', () => {
    expect(looksLikeCalendar('BEGIN:VCALENDAR\r\nEND:VCALENDAR')).toBe(true);
    expect(looksLikeCalendar('\uFEFF\nBEGIN:VCALENDAR\n')).toBe(true);
    expect(looksLikeCalendar('begin:vcalendar\n')).toBe(true);
  });

  it('refuses an HTML error page served as text/calendar', () => {
    expect(looksLikeCalendar('<!doctype html><html><body>404</body></html>')).toBe(false);
    expect(looksLikeCalendar('')).toBe(false);
  });
});
