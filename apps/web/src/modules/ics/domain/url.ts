/**
 * The URL guard for subscribed feeds — the security-critical half of this
 * slice, kept pure so every rule below is a unit test rather than a review
 * comment.
 *
 * A subscription URL is typed by a parent and fetched **by the server**, which
 * is the definition of an SSRF sink: without these rules, "paste the school's
 * agenda-link" is also "make Kynite GET anything our network can reach", and
 * the response comes back rendered as a calendar. So the guard runs in two
 * places and both are mandatory:
 *
 *  1. Here, on the string, *before* a DNS lookup — scheme, credentials, shape.
 *  2. In `../fetch.ts`, on every resolved address of every redirect hop, using
 *     `isBlockedAddress` below. A name that resolves to 127.0.0.1 today is a
 *     public name; the check therefore belongs to the *address*, not the host.
 *
 * Nothing here consults the network, so `../fetch.ts` owns the DNS half and
 * this file stays testable without one.
 */

/** Why a URL was refused. Each value is a translation key under `ics.errors`. */
export type UrlRejection =
  'urlInvalid' | 'urlScheme' | 'urlCredentials' | 'urlPrivateHost' | 'urlTooLong';

export type UrlCheck = { ok: true; url: URL } | { ok: false; error: UrlRejection };

/** Room for a signed feed link with a long query, and no room for a payload. */
const MAX_URL_LENGTH = 2048;

/**
 * `webcal://` and `webcals://` are Apple's "subscribe to this" scheme, and they
 * are what a school website's link actually says. Both are plain HTTPS on the
 * wire in every publisher we care about, so they are rewritten rather than
 * refused — refusing them would reject the single most common way a parent
 * arrives at this form.
 *
 * `http://` is *not* rewritten: silently upgrading it would claim a transport
 * guarantee we did not verify, and silently allowing it would let a feed be
 * rewritten in flight by anything between us and the publisher. It is refused
 * with its own message so the parent can go find the https link.
 */
const SCHEME_REWRITES: Record<string, string> = {
  'webcal:': 'https:',
  'webcals:': 'https:',
};

/**
 * Normalise and vet a user-supplied feed URL.
 *
 * Refuses, in order: anything unparseable, any scheme that is not https after
 * the webcal rewrite, credentials in the URL (`https://user:pass@host/…` — a
 * way to smuggle a host past a careless reader, and a way to leak a password
 * into our logs), and any host that is *literally* a private or reserved
 * address. A host **name** is not resolved here; `../fetch.ts` does that.
 */
export function checkFeedUrl(input: string): UrlCheck {
  const raw = input.trim();
  if (raw === '') return { ok: false, error: 'urlInvalid' };
  if (raw.length > MAX_URL_LENGTH) return { ok: false, error: 'urlTooLong' };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: 'urlInvalid' };
  }

  const rewritten = SCHEME_REWRITES[url.protocol];
  if (rewritten) {
    url.protocol = rewritten;
    // Some runtimes refuse to change the protocol of a non-special scheme in
    // place, so re-parse rather than trust the assignment above.
    try {
      url = new URL(url.toString().replace(/^webcals?:/i, 'https:'));
    } catch {
      return { ok: false, error: 'urlInvalid' };
    }
  }

  if (url.protocol !== 'https:') return { ok: false, error: 'urlScheme' };
  if (url.username !== '' || url.password !== '') {
    return { ok: false, error: 'urlCredentials' };
  }
  if (url.hostname === '') return { ok: false, error: 'urlInvalid' };

  // A literal address in the URL is checked here so the obvious attempt fails
  // instantly, with a message, instead of after a pointless DNS round trip.
  const literal = hostnameAsAddress(url.hostname);
  if (literal && isBlockedAddress(literal)) {
    return { ok: false, error: 'urlPrivateHost' };
  }

  return { ok: true, url };
}

/**
 * The hostname read as an IP literal, or null when it is a name.
 *
 * `URL` keeps IPv6 literals in brackets (`[::1]`) and normalises IPv4 ones, so
 * this is a bracket strip plus a shape test rather than a parser.
 */
export function hostnameAsAddress(hostname: string): string | null {
  const host =
    hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (host.includes(':')) return host;
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ? host : null;
}

function ipv4Octets(address: string): number[] | null {
  const parts = address.split('.');
  if (parts.length !== 4) return null;

  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
  return octets;
}

/**
 * True for anything a family's calendar feed can never legitimately live on:
 * this host, this network, the link-local range that carries cloud metadata,
 * and the reserved blocks either side of them.
 *
 * The list is deliberately a *deny* list of ranges rather than an allow list of
 * "the internet", because the ranges are finite and enumerable and "the
 * internet" is not. Ordered as they appear in RFC 1918 / RFC 6890:
 *
 * - `0.0.0.0/8`        "this network" — and `0.0.0.0` itself, which several
 *                      stacks route to localhost
 * - `10/8`, `172.16/12`, `192.168/16`   RFC 1918 private
 * - `127/8`            loopback
 * - `169.254/16`       link-local, which is where 169.254.169.254 (the cloud
 *                      instance-metadata endpoint) lives — the single highest
 *                      value target an SSRF has
 * - `100.64/10`        carrier-grade NAT
 * - `192.0.0/24`, `192.0.2/24`, `198.18/15`, `198.51.100/24`, `203.0.113/24`,
 *                      `224/4`, `240/4`   reserved / documentation / multicast
 * - `::1`, `::`        IPv6 loopback and unspecified
 * - `fc00::/7`         IPv6 unique-local
 * - `fe80::/10`        IPv6 link-local
 * - `::ffff:a.b.c.d`   IPv4-mapped IPv6, checked as its IPv4 address — the
 *                      bypass this function would otherwise have
 */
export function isBlockedAddress(address: string): boolean {
  const trimmed = address.trim().toLowerCase();
  if (trimmed === '') return true;

  if (!trimmed.includes(':')) return isBlockedIpv4(trimmed);

  // Strip a zone index (`fe80::1%eth0`) before anything else.
  const bare = trimmed.split('%')[0];

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(bare);
  if (mapped) return isBlockedIpv4(mapped[1]);
  // The same address written in hex (`::ffff:7f00:1`) is normalised by Node's
  // resolver to the dotted form above, but a hand-written one is not — treat
  // any `::ffff:` prefix as IPv4-mapped and therefore suspect.
  if (bare.startsWith('::ffff:')) return true;

  if (bare === '::1' || bare === '::' || bare === '0:0:0:0:0:0:0:1') return true;

  const firstHextet = bare.split(':')[0];
  const leading = Number.parseInt(firstHextet === '' ? '0' : firstHextet, 16);
  if (!Number.isFinite(leading)) return true;

  // fc00::/7 (unique-local) and fe80::/10 (link-local).
  if ((leading & 0xfe00) === 0xfc00) return true;
  if ((leading & 0xffc0) === 0xfe80) return true;

  return false;
}

function isBlockedIpv4(address: string): boolean {
  const octets = ipv4Octets(address);
  if (!octets) return true; // Unparseable: refuse rather than guess.

  const [a, b] = octets;

  if (a === 0) return true; // 0.0.0.0/8, "this network"
  if (a === 10) return true; // RFC 1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC 1918
  if (a === 192 && b === 168) return true; // RFC 1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0 && octets[2] <= 2) return true; // 192.0.0/24, 192.0.2/24
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && octets[2] === 100) return true; // documentation
  if (a === 203 && b === 0 && octets[2] === 113) return true; // documentation
  if (a >= 224) return true; // multicast + reserved, up to 255.255.255.255

  return false;
}

/**
 * A feed URL, made safe to show and safe to store in a log line.
 *
 * **A subscription URL is a bearer credential.** Social Schools' link carries
 * `userId` + `hash` and grants read access to a school's agenda with no login;
 * Magister, Somtoday and Zermelo hand out a secret URL by the same logic, and
 * Magister's own documentation calls rotating it the way to revoke access. A
 * URL like that is a password that happens to be shaped like a link, so it gets
 * treated like one: never logged, never in an error message, and never rendered
 * whole where a photograph of a wall tablet — or a screenshot in a support
 * thread — would carry it away.
 *
 * What survives is the host, which is the only part that answers "which
 * platform is this", plus the last four characters, which is enough to tell two
 * feeds from the same school apart and far too little to replay one. Both the
 * path and the query go, because either can hold the token depending on the
 * publisher.
 *
 * Unparseable input returns the ellipsis alone rather than an echo: a string
 * that failed to parse is exactly the string nobody has vetted.
 */
export function redactFeedUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return '…';
  }

  const tail = `${url.pathname}${url.search}`.replace(/\/+$/, '');
  if (tail === '') return url.hostname;

  return `${url.hostname}/…${tail.slice(-4)}`;
}

/**
 * Does this response body look like a calendar at all?
 *
 * Content type is checked *leniently* on purpose: schools serve their feed as
 * `text/plain`, as `application/octet-stream`, and occasionally with no type at
 * all, and refusing those would refuse the actual product requirement. The
 * honest test is the body — RFC 5545 says a calendar object begins
 * `BEGIN:VCALENDAR`, so that is the test, and a stray BOM or leading blank
 * lines do not change the answer.
 */
export function looksLikeCalendar(body: string): boolean {
  return /^\uFEFF?\s*BEGIN:VCALENDAR/i.test(body);
}
