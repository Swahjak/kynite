import { createHash, randomBytes } from 'node:crypto';

/**
 * Caregiver share-link credential primitives (docs/architecture.md §7
 * "Caregiver share links", PRD FR24/FR25).
 *
 * Pure and dependency-free — no database, no React, no `next/headers` — and it
 * lives in `lib/` for the same structural reason `@/lib/device-session` does.
 * Two sides need these values and they sit on opposite sides of an import
 * cycle: `modules/sharing/actions.ts` *mints* a token (and therefore imports
 * `@/modules/family` for `assertCan`), while `modules/sharing/view/` *resolves*
 * one — and the `(share)` tree that consumes the resolver may not transitively
 * reach a `'use server'` module at all (§2). Keeping the primitives here means
 * neither side has to import the other.
 *
 * The bargain is the same one every bearer secret in this codebase makes: the
 * raw value exists in the URL (and the QR that encodes it) and nowhere else,
 * and only its SHA-256 hash is ever written down.
 */

/** §7: "32-byte base64url token". 32 bytes of `randomBytes` → 43 characters. */
export const SHARE_TOKEN_BYTES = 32;

/** The exact length of `generateShareToken()`'s output — `ceil(32 / 3) * 4 - 1`. */
export const SHARE_TOKEN_LENGTH = 43;

/**
 * How much time must pass between two resolutions of the same link before the
 * second one counts as a fresh *visit*.
 *
 * `useCount` is a number a parent reads ("Oma opened this 3 times"), not a
 * request counter. One page view fans out into a document request plus
 * whatever the browser prefetches, and a contributor tick adds another
 * resolution on top; counting those individually would turn a single visit by
 * one grandparent into a number that means nothing to anybody. Five minutes is
 * long enough to swallow a page load and the taps that follow it, short enough
 * that "opened it again after dinner" still registers.
 *
 * The same window coalesces the *write*: without it every request to a share
 * link would be an UPDATE, which is the M12 device-session slide problem in
 * miniature.
 */
export const SHARE_USE_COALESCE_MS = 5 * 60 * 1000;

/** 32 random bytes, base64url — the raw value the URL and the QR carry (§7). */
export function generateShareToken(): string {
  return randomBytes(SHARE_TOKEN_BYTES).toString('base64url');
}

/**
 * SHA-256, hex, domain-separated.
 *
 * The `share:` prefix is not decoration: `hashDeviceToken` in
 * `@/lib/device-session` hashes 32 base64url bytes too, so without a domain tag
 * the two hash spaces would be the same function of the same input shape. A
 * leaked `device_session.token_hash` could then be looked up against
 * `share_link.token_hash` — and, worse, a future feature that let one kind of
 * token be presented where the other is expected would find a match. Prefixing
 * makes each credential's hash meaningful only in its own table.
 *
 * Not a password hash, on purpose: the input is 256 bits of system entropy, so
 * there is no dictionary to stretch against, and the resolver runs on every
 * request to a share view.
 */
export function hashShareToken(rawToken: string): string {
  return createHash('sha256').update(`share:${rawToken}`).digest('hex');
}

/**
 * Whether a URL segment is even shaped like a token, before any database work.
 *
 * A share URL is the whole credential, so `/s/<anything>` is a public,
 * unauthenticated endpoint that anyone can point a script at. Rejecting the
 * malformed 99% here means a scan costs no query at all, and it keeps the
 * `notFound` path free of surprises like a multi-kilobyte segment.
 */
export function isShareTokenShaped(token: string): boolean {
  return token.length === SHARE_TOKEN_LENGTH && /^[A-Za-z0-9_-]+$/.test(token);
}

/**
 * The absolute URL a caregiver receives, and the string the QR encodes.
 *
 * Locale-prefixed because every `[locale]` route is: an unprefixed `/s/<token>`
 * would be redirected by next-intl, and a redirect on a URL that *is* a bearer
 * secret is a second place for it to end up in a log.
 */
export function shareUrlFor(origin: string, locale: string, rawToken: string): string {
  return `${origin.replace(/\/+$/, '')}/${locale}/s/${rawToken}`;
}
