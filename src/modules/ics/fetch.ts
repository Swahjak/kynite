import 'server-only';
import { lookup } from 'node:dns/promises';
import { checkFeedUrl, hostnameAsAddress, isBlockedAddress, looksLikeCalendar } from './domain/url';

/**
 * The one place a subscribed feed is fetched.
 *
 * Everything that makes a user-supplied URL safe to fetch server-side lives
 * here or in `domain/url.ts`, and nothing else in the app may call `fetch` with
 * a subscription URL. The rules, and why each one is not optional:
 *
 * - **https only, no credentials** — `domain/url.ts`, on the string.
 * - **Every hop is re-validated.** Redirects are followed manually
 *   (`redirect: 'manual'`), because `fetch`'s own following would resolve and
 *   connect to `Location:` without asking us — and "https://school.example/ics
 *   → http://169.254.169.254/latest/meta-data" is precisely the attack. At most
 *   three hops, each one back through the full check.
 * - **DNS is resolved before connecting**, and every returned address is
 *   checked against the private/reserved ranges. A hostname is public; the
 *   address it resolves to is what actually gets connected to, and an attacker
 *   controls a DNS record far more easily than a URL scheme.
 * - **Size and time are capped** (5 MB / 15 s), streaming, so a feed that never
 *   ends cannot hold a worker or a heap.
 * - **The body must look like a calendar.** Content type is advisory only —
 *   real school feeds arrive as `text/plain` — so the `BEGIN:VCALENDAR` sniff
 *   is the actual gate.
 *
 * A residual DNS-rebinding window remains (the address checked is not
 * provably the address connected to). Closing it needs a custom
 * dispatcher/agent pinned to the vetted IP; it is out of scope here and is
 * recorded rather than glossed over — the ranges above are still refused on
 * every lookup, so a rebind must win a race rather than simply be asked for.
 */

export const MAX_FEED_BYTES = 5 * 1024 * 1024;
export const FETCH_TIMEOUT_MS = 15_000;
export const MAX_REDIRECTS = 3;

/** Failure modes, as translation keys under `ics.errors`. */
export type FetchFailure =
  | 'urlInvalid'
  | 'urlScheme'
  | 'urlCredentials'
  | 'urlPrivateHost'
  | 'urlTooLong'
  | 'tooManyRedirects'
  | 'unreachable'
  | 'timeout'
  | 'httpError'
  | 'tooLarge'
  | 'notCalendar';

export type FetchSuccess = {
  ok: true;
  /** Absent on a 304 — the caller keeps what it has. */
  body: string | null;
  notModified: boolean;
  etag: string | null;
  lastModified: string | null;
};

export type FetchResult = FetchSuccess | { ok: false; error: FetchFailure; status?: number };

export type FetchOptions = {
  /** Conditional-GET tokens from the last successful fetch. */
  etag?: string | null;
  lastModified?: string | null;
  /** Injected by the tests; production uses the platform `fetch`. */
  fetchImpl?: typeof fetch;
  /** Injected by the tests; production resolves through the system resolver. */
  resolveHost?: (hostname: string) => Promise<string[]>;
};

async function resolveAddresses(hostname: string): Promise<string[]> {
  const literal = hostnameAsAddress(hostname);
  if (literal) return [literal];

  // `all: true` matters: a name with both an A and an AAAA record must have
  // *both* checked, or a public A record can front a loopback AAAA one.
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

/**
 * Fetch a feed, or say why not. Never throws for a remote failure — a school
 * server that is down is an expected state of this feature, not an exception.
 */
export async function fetchFeed(rawUrl: string, options: FetchOptions = {}): Promise<FetchResult> {
  const doFetch = options.fetchImpl ?? fetch;
  const resolve = options.resolveHost ?? resolveAddresses;

  let target = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const checked = checkFeedUrl(target);
    if (!checked.ok) return { ok: false, error: checked.error };

    const url = checked.url;

    let addresses: string[];
    try {
      addresses = await resolve(url.hostname);
    } catch {
      return { ok: false, error: 'unreachable' };
    }

    if (addresses.length === 0) return { ok: false, error: 'unreachable' };
    if (addresses.some(isBlockedAddress)) return { ok: false, error: 'urlPrivateHost' };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await doFetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: conditionalHeaders(hop === 0 ? options : {}),
      });
    } catch {
      return { ok: false, error: controller.signal.aborted ? 'timeout' : 'unreachable' };
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 304) {
      return { ok: true, body: null, notModified: true, etag: null, lastModified: null };
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return { ok: false, error: 'httpError', status: response.status };
      // Relative redirects are legal and common; resolve against the hop we are
      // on, then let the next iteration re-run every check on the result.
      target = new URL(location, url).toString();
      continue;
    }

    if (!response.ok) return { ok: false, error: 'httpError', status: response.status };

    const declared = Number(response.headers.get('content-length') ?? '');
    if (Number.isFinite(declared) && declared > MAX_FEED_BYTES) {
      return { ok: false, error: 'tooLarge' };
    }

    let body: string;
    try {
      body = await readCapped(response);
    } catch (error) {
      return { ok: false, error: error instanceof FeedTooLargeError ? 'tooLarge' : 'unreachable' };
    }

    if (!looksLikeCalendar(body)) return { ok: false, error: 'notCalendar' };

    return {
      ok: true,
      body,
      notModified: false,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    };
  }

  return { ok: false, error: 'tooManyRedirects' };
}

class FeedTooLargeError extends Error {}

function conditionalHeaders(options: Pick<FetchOptions, 'etag' | 'lastModified'>): HeadersInit {
  const headers: Record<string, string> = {
    // Advisory: a publisher that honours it sends the calendar rather than an
    // HTML landing page. The body sniff is what actually decides.
    accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5',
    'user-agent': 'Kynite/1.0 (+calendar subscription)',
  };

  if (options.etag) headers['if-none-match'] = options.etag;
  if (options.lastModified) headers['if-modified-since'] = options.lastModified;
  return headers;
}

/**
 * Read the body, streaming, and stop the moment it exceeds the cap.
 *
 * `response.text()` would buffer the whole thing first, which makes the cap a
 * post-hoc opinion about memory that has already been spent.
 */
async function readCapped(response: Response): Promise<string> {
  const body = response.body;
  if (!body) return response.text();

  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let total = 0;
  let text = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_FEED_BYTES) throw new FeedTooLargeError();
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  return text + decoder.decode();
}
