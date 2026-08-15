import { createHash, randomBytes } from 'node:crypto';

/**
 * Second-parent invite credential primitives (PRD FR26, milestone M14).
 *
 * The third bearer secret in this codebase, and it follows the two before it
 * exactly: 32 random bytes, base64url, SHA-256 at rest, domain-separated hash.
 * It lives in `lib/` for the same structural reason `@/lib/share-token` and
 * `@/lib/device-session` do — the mint side (`modules/family/actions.ts`) and
 * the resolve side (the `(auth)/invite/[token]` route) sit on opposite sides of
 * an import edge, and neither should have to reach through the other to agree
 * on what an invite token *is*.
 *
 * What makes this token different from the other two is what it buys. A share
 * token grants a read; a device token grants a kiosk. An invite token grants an
 * *identity*: presenting it is the only thing standing between a stranger and a
 * login attached to a real member row in a real household. That is why it is
 * single-use, short-lived and revocable, and why every one of those three
 * properties is enforced by the claiming UPDATE's predicate rather than by a
 * read-then-write in application code (see `claimInvite`).
 */

/** Same 32 bytes as every other bearer secret here — `randomBytes(32)` → 43 chars. */
export const INVITE_TOKEN_BYTES = 32;

/** The exact length of `generateInviteToken()`'s output — `ceil(32 / 3) * 4 - 1`. */
export const INVITE_TOKEN_LENGTH = 43;

/**
 * How long an invite stays acceptable.
 *
 * Seven days, and the number is a product judgement rather than a security one:
 * the link is sent over WhatsApp to somebody who lives in the same house, so it
 * has to survive a weekend and a forgotten phone, but a co-parent invite that is
 * still live three months later is a credential nobody remembers issuing. The
 * owner can always send another — minting is one click, and revocation is one
 * click, so a short window costs nothing and an unbounded one costs everything.
 */
export const INVITE_TTL_DAYS = 7;

export const INVITE_TTL_MS = INVITE_TTL_DAYS * 24 * 60 * 60 * 1000;

/** 32 random bytes, base64url — the raw value the invite link carries. */
export function generateInviteToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString('base64url');
}

/**
 * SHA-256, hex, domain-separated with `invite:`.
 *
 * All three token types in this repo hash 32 base64url bytes, so without a
 * domain tag they would be the same function of the same input shape and a hash
 * leaked from one table could be looked up against another. The stakes are
 * highest here: a `share_link.token_hash` that happened to match an
 * `invite.token_hash` would turn a read-only caregiver link into an account.
 * The prefix makes each credential's hash meaningful only in its own table.
 *
 * Not a password hash, deliberately — the input is 256 bits of system entropy,
 * so there is no dictionary to stretch against.
 */
export function hashInviteToken(rawToken: string): string {
  return createHash('sha256').update(`invite:${rawToken}`).digest('hex');
}

/**
 * Whether a URL segment is even shaped like a token, before any database work.
 *
 * `/invite/<anything>` is a public, unauthenticated endpoint that anyone can
 * point a script at. Rejecting the malformed 99% here means a scan costs no
 * query at all.
 */
export function isInviteTokenShaped(token: string): boolean {
  return token.length === INVITE_TOKEN_LENGTH && /^[A-Za-z0-9_-]+$/.test(token);
}

/** When an invite minted at `now` stops being acceptable. */
export function inviteExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITE_TTL_MS);
}

/**
 * The absolute URL the owner sends the second parent.
 *
 * Locale-prefixed for the same reason share links are: an unprefixed
 * `/invite/<token>` would be redirected by next-intl, and a redirect on a URL
 * that *is* a bearer secret is a second place for it to end up in a log.
 */
export function inviteUrlFor(origin: string, locale: string, rawToken: string): string {
  return `${origin.replace(/\/+$/, '')}/${locale}/invite/${rawToken}`;
}
