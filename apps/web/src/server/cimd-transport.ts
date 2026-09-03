import type { LookupAddress, LookupOptions } from 'node:dns';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { Readable } from 'node:stream';
import * as z from 'zod';
import type { ClientMetadataResourceFetch } from '@better-auth/oauth-provider';

/**
 * Own copy of `@better-auth/cimd/node`'s `fetchClientMetadataResource`.
 *
 * Upstream bug (`@better-auth/cimd@1.7.2`, `dist/node.mjs`): the transport's
 * `https.request({ lookup })` callback uses the legacy 3-arg form
 * `callback(null, address, family)`. Node >=20 with `autoSelectFamily`
 * (default since Node 20, and the only path taken on Node 24) calls a
 * user-supplied `lookup` with `options.all === true` and expects the array
 * form `callback(null, [{ address, family }])` instead. The legacy form
 * throws `TypeError [ERR_INVALID_IP_ADDRESS]: Invalid IP address: undefined`
 * inside `net.js`, so every OAuth client-metadata fetch fails and
 * `/api/auth/oauth2/authorize` returns `invalid_client` for every CIMD
 * client. Verified directly in the prod container: the legacy call form
 * throws, the array form resolves with a 200.
 *
 * This file is a 1:1 port of the upstream transport (same SSRF guards, same
 * request construction) with only that one callback fixed to handle both
 * forms. Delete this file and go back to importing
 * `fetchClientMetadataResource` from `@better-auth/cimd/node` once upstream
 * ships the fix (https://github.com/better-auth/better-auth — track cimd's
 * `dist/node.mjs`).
 */

const BODY_FORBIDDEN_RESPONSE_STATUSES = new Set([204, 205, 304]);

function responseHeaders(headers: NodeJS.Dict<string | string[]>): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) result.append(name, item);
    } else if (value !== undefined) {
      result.append(name, value);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Ported from `@better-auth/core/utils/ip` (only the pieces `classifyHost`
// needs) and `@better-auth/core/utils/host`. `@better-auth/core` is a
// transitive dependency resolved inside `@better-auth/cimd`'s own
// `node_modules`, not one `apps/web` can import directly under pnpm's strict
// resolution — hence the port rather than a re-export.
// ---------------------------------------------------------------------------

function isValidIP(ip: string): boolean {
  return z.ipv4().safeParse(ip).success || z.ipv6().safeParse(ip).success;
}

function isIPv6(ip: string): boolean {
  return z.ipv6().safeParse(ip).success;
}

function expandIPv6(ipv6: string): string[] {
  if (ipv6.includes('::')) {
    const sides = ipv6.split('::');
    const left = sides[0] ? sides[0].split(':') : [];
    const right = sides[1] ? sides[1].split(':') : [];
    const totalGroups = 8;
    const missingGroups = totalGroups - left.length - right.length;
    const zeros = Array(missingGroups).fill('0000');
    const paddedLeft = left.map((g) => g.padStart(4, '0'));
    const paddedRight = right.map((g) => g.padStart(4, '0'));
    return [...paddedLeft, ...zeros, ...paddedRight];
  }
  return ipv6.split(':').map((g) => g.padStart(4, '0'));
}

function extractIPv4FromMapped(ipv6: string): string | null {
  const lower = ipv6.toLowerCase();

  if (lower.startsWith('::ffff:')) {
    const ipv4Part = lower.substring(7);
    if (z.ipv4().safeParse(ipv4Part).success) {
      return ipv4Part;
    }
  }

  const parts = ipv6.split(':');
  if (parts.length === 7 && parts[5]?.toLowerCase() === 'ffff') {
    const ipv4Part = parts[6];
    if (ipv4Part && z.ipv4().safeParse(ipv4Part).success) {
      return ipv4Part;
    }
  }

  if (lower.includes('::ffff:') || lower.includes(':ffff:')) {
    const groups = expandIPv6(ipv6);
    if (
      groups.length === 8 &&
      groups[0] === '0000' &&
      groups[1] === '0000' &&
      groups[2] === '0000' &&
      groups[3] === '0000' &&
      groups[4] === '0000' &&
      groups[5] === 'ffff' &&
      groups[6] &&
      groups[7]
    ) {
      const byte1 = Number.parseInt(groups[6].substring(0, 2), 16);
      const byte2 = Number.parseInt(groups[6].substring(2, 4), 16);
      const byte3 = Number.parseInt(groups[7].substring(0, 2), 16);
      const byte4 = Number.parseInt(groups[7].substring(2, 4), 16);
      return `${byte1}.${byte2}.${byte3}.${byte4}`;
    }
  }

  return null;
}

function normalizeIPv6(ipv6: string, subnetPrefix?: number): string {
  const groups = expandIPv6(ipv6);

  if (subnetPrefix !== undefined && subnetPrefix < 128) {
    const prefix = Math.max(0, Math.floor(subnetPrefix));
    let bitsRemaining: number = prefix;

    const maskedGroups = groups.map((group) => {
      if (bitsRemaining <= 0) {
        return '0000';
      }
      if (bitsRemaining >= 16) {
        bitsRemaining -= 16;
        return group;
      }
      const value = Number.parseInt(group, 16);
      const mask = (0xffff << (16 - bitsRemaining)) & 0xffff;
      const masked = value & mask;
      bitsRemaining = 0;
      return masked.toString(16).padStart(4, '0');
    });

    return maskedGroups.join(':').toLowerCase();
  }

  return groups.join(':').toLowerCase();
}

function normalizeIP(ip: string, options: { ipv6Subnet?: number } = {}): string {
  if (z.ipv4().safeParse(ip).success) {
    return ip.toLowerCase();
  }

  if (!isIPv6(ip)) {
    return ip.toLowerCase();
  }

  const ipv4 = extractIPv4FromMapped(ip);
  if (ipv4) {
    return ipv4.toLowerCase();
  }

  const subnetPrefix = options.ipv6Subnet ?? 64;
  return normalizeIPv6(ip, subnetPrefix);
}

type HostKind =
  | 'loopback'
  | 'localhost'
  | 'unspecified'
  | 'private'
  | 'linkLocal'
  | 'sharedAddressSpace'
  | 'documentation'
  | 'benchmarking'
  | 'multicast'
  | 'broadcast'
  | 'reserved'
  | 'cloudMetadata'
  | 'public';

const CLOUD_METADATA_HOSTS: ReadonlySet<string> = new Set([
  'metadata.google.internal',
  'metadata.goog',
  'metadata',
  'instance-data',
  'instance-data.ec2.internal',
]);

function stripBrackets(host: string): string {
  if (host.length >= 2 && host.startsWith('[') && host.endsWith(']')) {
    return host.slice(1, -1);
  }
  return host;
}

function stripPort(host: string): string {
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    if (end === -1) return host;
    return host.slice(0, end + 1);
  }
  const firstColon = host.indexOf(':');
  if (firstColon === -1) return host;
  if (host.indexOf(':', firstColon + 1) !== -1) return host;
  return host.slice(0, firstColon);
}

function stripZoneId(host: string): string {
  const zone = host.indexOf('%');
  if (zone === -1) return host;
  return host.slice(0, zone);
}

function stripTrailingDot(host: string): string {
  return host.replace(/\.+$/, '');
}

function looksLikeIPv4(host: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

function ipv4ToUint32(ip: string): number {
  const parts = ip.split('.');
  return (
    ((Number(parts[0]) << 24) |
      (Number(parts[1]) << 16) |
      (Number(parts[2]) << 8) |
      Number(parts[3])) >>>
    0
  );
}

function inIPv4Range(value: number, prefix: number, length: number): boolean {
  if (length === 0) return true;
  const mask = length === 32 ? 0xffffffff : (~0 << (32 - length)) >>> 0;
  return (value & mask) === (prefix & mask);
}

function classifyIPv4(ip: string): HostKind {
  if (ip === '0.0.0.0') return 'unspecified';
  if (ip === '255.255.255.255') return 'broadcast';

  const n = ipv4ToUint32(ip);

  if (inIPv4Range(n, ipv4ToUint32('127.0.0.0'), 8)) return 'loopback';
  if (inIPv4Range(n, ipv4ToUint32('10.0.0.0'), 8)) return 'private';
  if (inIPv4Range(n, ipv4ToUint32('172.16.0.0'), 12)) return 'private';
  if (inIPv4Range(n, ipv4ToUint32('192.168.0.0'), 16)) return 'private';
  if (inIPv4Range(n, ipv4ToUint32('169.254.0.0'), 16)) return 'linkLocal';
  if (inIPv4Range(n, ipv4ToUint32('100.64.0.0'), 10)) return 'sharedAddressSpace';
  if (inIPv4Range(n, ipv4ToUint32('192.0.2.0'), 24)) return 'documentation';
  if (inIPv4Range(n, ipv4ToUint32('198.51.100.0'), 24)) return 'documentation';
  if (inIPv4Range(n, ipv4ToUint32('203.0.113.0'), 24)) return 'documentation';
  if (inIPv4Range(n, ipv4ToUint32('198.18.0.0'), 15)) return 'benchmarking';
  if (inIPv4Range(n, ipv4ToUint32('224.0.0.0'), 4)) return 'multicast';
  if (inIPv4Range(n, ipv4ToUint32('0.0.0.0'), 8)) return 'reserved';
  if (inIPv4Range(n, ipv4ToUint32('192.0.0.0'), 24)) return 'reserved';
  // 6to4 relay anycast (RFC 7526, deprecated), not globally reachable.
  if (inIPv4Range(n, ipv4ToUint32('192.88.99.0'), 24)) return 'reserved';
  if (inIPv4Range(n, ipv4ToUint32('240.0.0.0'), 4)) return 'reserved';

  return 'public';
}

function extractEmbeddedIPv4(
  expanded: string,
  startGroup: number,
  options: { xor?: boolean } = {}
): string | null {
  const offset = startGroup * 5;
  const g1 = Number.parseInt(expanded.slice(offset, offset + 4), 16);
  const g2 = Number.parseInt(expanded.slice(offset + 5, offset + 9), 16);
  if (!Number.isFinite(g1) || !Number.isFinite(g2)) return null;
  let combined = ((g1 << 16) | g2) >>> 0;
  if (options.xor) combined = (combined ^ 0xffffffff) >>> 0;
  return `${(combined >>> 24) & 0xff}.${(combined >>> 16) & 0xff}.${(combined >>> 8) & 0xff}.${combined & 0xff}`;
}

function classifyIPv6(expanded: string): HostKind {
  if (expanded === '0000:0000:0000:0000:0000:0000:0000:0000') return 'unspecified';
  if (expanded === '0000:0000:0000:0000:0000:0000:0000:0001') return 'loopback';

  const firstByte = Number.parseInt(expanded.slice(0, 2), 16);
  const secondByte = Number.parseInt(expanded.slice(2, 4), 16);

  if (firstByte === 0xff) return 'multicast';
  if (firstByte === 0xfe && (secondByte & 0xc0) === 0x80) return 'linkLocal';
  // fec0::/10 — deprecated site-local (RFC 3879), not globally reachable.
  if (firstByte === 0xfe && (secondByte & 0xc0) === 0xc0) return 'reserved';
  if ((firstByte & 0xfe) === 0xfc) return 'private';

  if (expanded.startsWith('2001:0db8:')) return 'documentation';

  // 2001:2::/48 — Benchmarking (RFC 5180).
  if (expanded.startsWith('2001:0002:0000:')) return 'benchmarking';

  if (expanded.startsWith('2002:')) {
    const embedded = extractEmbeddedIPv4(expanded, 1);
    if (embedded && classifyIPv4(embedded) !== 'public') return 'reserved';
    return 'public';
  }

  if (expanded.startsWith('0064:ff9b:0000:0000:0000:0000:')) {
    const embedded = extractEmbeddedIPv4(expanded, 6);
    if (embedded && classifyIPv4(embedded) !== 'public') return 'reserved';
    return 'reserved';
  }

  // 64:ff9b:1::/48 — Local-Use IPv4/IPv6 Translation (RFC 8215).
  if (expanded.startsWith('0064:ff9b:0001:')) return 'reserved';

  if (expanded.startsWith('2001:0000:')) {
    const embedded = extractEmbeddedIPv4(expanded, 6, { xor: true });
    if (embedded && classifyIPv4(embedded) !== 'public') return 'reserved';
    return 'reserved';
  }

  if (expanded.startsWith('0100:0000:0000:0000:')) return 'reserved';

  // 3fff::/20 — Documentation (RFC 9637).
  if (expanded.startsWith('3fff:0')) return 'documentation';

  // 5f00::/16 — SRv6 SIDs (RFC 9602), not globally reachable.
  if (expanded.startsWith('5f00:')) return 'reserved';

  // ::/96 — deprecated IPv4-compatible IPv6 (RFC 4291 §2.5.5.1).
  if (expanded.startsWith('0000:0000:0000:0000:0000:0000:')) return 'reserved';

  return 'public';
}

function classifyHostKind(host: string): HostKind {
  const stripped = stripTrailingDot(stripZoneId(stripBrackets(stripPort(host.trim()))));
  const lowered = stripped.toLowerCase();

  if (lowered === '') {
    return 'reserved';
  }

  if (!isValidIP(lowered)) {
    if (lowered === 'localhost' || lowered.endsWith('.localhost')) {
      return 'localhost';
    }
    if (CLOUD_METADATA_HOSTS.has(lowered)) {
      return 'cloudMetadata';
    }
    return 'public';
  }

  if (looksLikeIPv4(lowered)) {
    return classifyIPv4(lowered);
  }

  const canonical = normalizeIP(lowered, { ipv6Subnet: 128 });

  if (looksLikeIPv4(canonical)) {
    return classifyIPv4(canonical);
  }

  return classifyIPv6(canonical);
}

/**
 * SSRF gate: true only for hosts that classify as `public` per RFC 6890 /
 * RFC 6761. Ported 1:1 from `@better-auth/core/utils/host`'s
 * `isPublicRoutableHost` (see that module's doc comment for the full
 * rationale and limitations — this is a syntactic/DNS-answer check, not a
 * complete SSRF mitigation on its own).
 */
function isPublicRoutableHost(host: string): boolean {
  return classifyHostKind(host) === 'public';
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

/**
 * The dual-form DNS `lookup` callback, extracted for direct unit testing.
 * Node's `net.js` calls this with `options.all === true` when
 * `autoSelectFamily` is active (default on Node >=20, so effectively always)
 * and expects the array form; older/legacy call sites still use the 3-arg
 * form. Handling both is the entire fix over the upstream transport.
 */
export function pinnedLookup(
  pinnedAddress: Pick<LookupAddress, 'address' | 'family'>
): (
  hostname: string,
  options: LookupOptions,
  callback: (
    err: NodeJS.ErrnoException | null,
    address: string | LookupAddress[],
    family?: number
  ) => void
) => void {
  return (_hostname, options, callback) => {
    if (options && typeof options === 'object' && (options as { all?: boolean }).all) {
      callback(null, [{ address: pinnedAddress.address, family: pinnedAddress.family }]);
    } else {
      callback(null, pinnedAddress.address, pinnedAddress.family);
    }
  };
}

/**
 * Fetch a CIMD-owned HTTPS resource with resolve-once DNS validation and
 * connection pinning.
 *
 * Every DNS answer must be public-routable. The selected answer is pinned for
 * the connection while the original hostname remains the HTTP Host, TLS SNI,
 * and certificate-verification identity. Redirect responses are returned to
 * the caller and are never followed.
 *
 * See the file-level doc comment for why this exists instead of importing
 * `@better-auth/cimd/node`'s transport directly.
 */
export const fetchClientMetadataResource: ClientMetadataResourceFetch = async (input, init) => {
  const webRequest = new Request(input, init);
  const url = new URL(webRequest.url);
  if (url.protocol !== 'https:') throw new TypeError('CIMD Node transport requires an HTTPS URL');
  if (webRequest.method !== 'GET' && webRequest.method !== 'HEAD')
    throw new TypeError('CIMD Node transport supports only GET and HEAD');

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0) throw new TypeError('metadata hostname returned no DNS addresses');
  for (const result of addresses) {
    if (!isPublicRoutableHost(result.address)) {
      throw new TypeError('metadata hostname must resolve only to public-routable addresses');
    }
  }
  const pinnedAddress = addresses[0]!;

  const headers = Object.fromEntries(webRequest.headers.entries());
  headers.host = url.host;

  const signal = init?.signal ?? (input instanceof Request ? input.signal : webRequest.signal);

  return new Promise<Response>((resolve, reject) => {
    const nodeRequest = request(
      url,
      {
        agent: false,
        headers,
        method: webRequest.method,
        servername: isIP(url.hostname.replace(/^\[|\]$/g, '')) === 0 ? url.hostname : undefined,
        signal,
        lookup: pinnedLookup(pinnedAddress),
      },
      (response) => {
        const status = response.statusCode ?? 500;
        const body =
          webRequest.method === 'HEAD' || BODY_FORBIDDEN_RESPONSE_STATUSES.has(status)
            ? null
            : (Readable.toWeb(response) as ReadableStream<Uint8Array>);
        resolve(
          new Response(body, {
            headers: responseHeaders(response.headers),
            status,
            statusText: response.statusMessage,
          })
        );
      }
    );
    nodeRequest.once('error', reject);
    nodeRequest.end();
  });
};
