import { createHash, randomBytes, randomInt } from 'node:crypto';

/**
 * Kiosk credential primitives (docs/architecture.md §7 "Kiosk device pairing").
 *
 * Pure and dependency-free: no database, no React, no `next/headers`. It lives
 * in `lib/` rather than in `modules/devices/domain/` for one structural reason.
 * Two slices need these values and they sit on opposite sides of an import
 * cycle: `modules/devices` *mints* the credential (and therefore imports
 * `modules/family` for `assertCan`), while `modules/family/principal.ts`
 * *resolves* it into a principal. A slice barrel in either direction closes the
 * loop, and the `domain/` deep-import exemption only covers `domain/ → domain/`
 * (eslint.config.mjs), which `principal.ts` is not. `lib/` is the one place
 * both can reach without a cycle and without widening a boundary rule.
 *
 * Everything here is deliberately symmetric with M13's share tokens: the raw
 * secret exists only in the cookie, and only its SHA-256 hash is ever stored.
 */

/**
 * The kiosk cookie. Deliberately *not* prefixed `__Host-`: that prefix forces
 * `secure` unconditionally, and `deviceCookieOptions()` below only sets
 * `secure` in production so the cookie still attaches over plain HTTP in
 * development and on a LAN-only wall tablet install — a `__Host-` name would
 * make the browser silently drop it there. `path=/` and no `Domain=` — the
 * other two `__Host-` requirements, and the reason the prefix would cost
 * nothing in production — are already true of this cookie; there is simply no
 * subdomain scoping to give up. Production already gets `secure` +
 * `SameSite=Lax` + `httpOnly`; the prefix is skipped only for the dev/LAN case.
 */
export const DEVICE_SESSION_COOKIE = 'kynite_device_session';

/** §7: "the opaque token lives in an httpOnly cookie with 1-year expiry". */
export const DEVICE_SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * How much of the year must be consumed before a use re-stamps the expiry.
 *
 * §7 says the session slides "on each use", and it does — but a wall tablet
 * polls `/api/timers` every two seconds, so a literal write per use would be
 * ~43 000 UPDATEs a day per device to move a timestamp that is a year out.
 * One hour is the coalescing window: the guarantee families care about ("a hub
 * that is used never logs out") holds to within an hour, and the write volume
 * drops to at most 24 rows a day per device.
 */
export const DEVICE_SESSION_SLIDE_INTERVAL_MS = 60 * 60 * 1000;

/** §7: "parent generates a 6-digit code (10-min TTL)". */
export const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;

export const PAIRING_CODE_LENGTH = 6;

/**
 * Brute-force budget for `(hub)/pair`. The code space is 10^6 and a code lives
 * for ten minutes, so the attack that matters is a script hammering the pair
 * form. Ten wrong codes per window per client is roughly a person mistyping
 * twice and then some — a first line of defense that stops casual retry, but
 * not the guarantee: the fingerprint it buckets on (`x-forwarded-for[0]` +
 * user agent) is attacker-controlled, so a script that rotates either defeats
 * this bucket at will. Enforced in `modules/devices/queries.ts` against a
 * client fingerprint, and the counters are trimmed nightly.
 */
export const PAIRING_MAX_FAILURES = 10;
export const PAIRING_FAILURE_WINDOW_MS = 10 * 60 * 1000;

/**
 * The actual guarantee against a distributed scan: a *global* failed-attempt
 * budget, counted across every client fingerprint, in the same sliding window
 * as the per-client bucket. A household pairs a device once in a great while,
 * so legitimate concurrent failures across an entire install are rare — a
 * handful of mistyped codes at most. A script guessing the 10^6 code space
 * exhausts this budget in seconds regardless of how many fingerprints it
 * spreads across, because rotating the fingerprint does not create a second
 * global budget. When it trips, every pairing attempt fails closed with the
 * same generic `rateLimited` outcome the per-client bucket already returns —
 * there is deliberately no way to tell "this client is throttled" from
 * "everyone is throttled" from the response.
 */
export const PAIRING_GLOBAL_MAX_FAILURES = 100;

/**
 * The cap on *live* (unconsumed, unexpired) pairing codes a single family may
 * hold at once. Without it, a script that knows or guesses one family's id
 * indirectly (or simply spams `createPairingCodeAction`) could keep minting
 * codes into the shared, cross-tenant code space — one family's flood
 * narrows the pool every other family's codes are drawn from. Three is more
 * than a household ever needs concurrently (one screen being paired, maybe a
 * second generated because the first was misread), and `createPairingCode`
 * fails closed above it rather than evicting an older code a parent may still
 * be about to type in.
 */
export const PAIRING_MAX_LIVE_CODES_PER_FAMILY = 3;

/** 32 random bytes, base64url — the raw value the cookie carries (§7). */
export function generateDeviceToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * SHA-256, hex. Not a password hash on purpose: the input is 256 bits of
 * system entropy, so there is no dictionary to stretch against, and the
 * resolver runs on every kiosk request.
 */
export function hashDeviceToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * A 6-digit pairing code, uniformly distributed and zero-padded.
 *
 * `randomInt` rejects modulo bias internally, which `randomBytes() % 1e6`
 * would not — with only a million codes and ten minutes to guess one, a skewed
 * distribution is a real narrowing of the space rather than a purity argument.
 */
export function generatePairingCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(PAIRING_CODE_LENGTH, '0');
}

/** Digits only, exactly `PAIRING_CODE_LENGTH` — spaces and dashes are forgiven. */
export function normalizePairingCode(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '');
  return new RegExp(`^\\d{${PAIRING_CODE_LENGTH}}$`).test(digits) ? digits : null;
}

/** Codes are stored hashed too: a leaked backup must not be a pairing kit. */
export function hashPairingCode(code: string): string {
  return createHash('sha256').update(`pairing:${code}`).digest('hex');
}

/** The absolute expiry a freshly stamped session gets. */
export function deviceSessionExpiry(now: Date): Date {
  return new Date(now.getTime() + DEVICE_SESSION_TTL_MS);
}

/**
 * Whether this use should re-stamp the session (see
 * `DEVICE_SESSION_SLIDE_INTERVAL_MS`). `lastSeenAt` is the coalescing clock
 * rather than `expiresAt`, so the same predicate covers the "when was this
 * tablet last awake" column the settings list shows.
 */
export function shouldSlideDeviceSession(lastSeenAt: Date | null, now: Date): boolean {
  if (!lastSeenAt) return true;
  return now.getTime() - lastSeenAt.getTime() >= DEVICE_SESSION_SLIDE_INTERVAL_MS;
}

/**
 * Cookie attributes, in one place so the mint and the renewal cannot drift
 * apart — the criterion is asserted on both.
 *
 * `secure` is on except in development: an http://localhost kiosk would never
 * receive the cookie otherwise, and there is no session to protect there.
 */
export function deviceCookieOptions(now: Date = new Date()): {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  expires: Date;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: deviceSessionExpiry(now),
    maxAge: Math.floor(DEVICE_SESSION_TTL_MS / 1000),
  };
}
