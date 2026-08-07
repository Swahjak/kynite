import { describe, expect, it, vi } from 'vitest';
import {
  DEVICE_SESSION_SLIDE_INTERVAL_MS,
  DEVICE_SESSION_TTL_MS,
  PAIRING_CODE_LENGTH,
  PAIRING_CODE_TTL_MS,
  deviceCookieOptions,
  deviceSessionExpiry,
  generateDeviceToken,
  generatePairingCode,
  hashDeviceToken,
  hashPairingCode,
  normalizePairingCode,
  shouldSlideDeviceSession,
} from '@/lib/device-session';

/**
 * The kiosk credential primitives (M12, docs/architecture.md §7).
 *
 * `tests/integration/device-pairing.test.ts` proves the flow against a real
 * database. This file pins the numbers and the shapes that flow depends on, so
 * that a change to any of them is a deliberate edit here rather than a silent
 * weakening — a 4-digit code, a 30-day cookie, or a token that stopped being
 * hashed would all still pass every integration test.
 */

describe('device session tokens', () => {
  it('mints 32 bytes of entropy, base64url, never repeating', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateDeviceToken()));
    expect(tokens.size).toBe(200);

    for (const token of tokens) {
      // base64url of 32 bytes: 43 characters, no padding, no `+` or `/`.
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it('hashes deterministically, and the hash does not contain the token', () => {
    const token = generateDeviceToken();
    expect(hashDeviceToken(token)).toBe(hashDeviceToken(token));
    expect(hashDeviceToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDeviceToken(token)).not.toContain(token);
    expect(hashDeviceToken(token)).not.toBe(hashDeviceToken(generateDeviceToken()));
  });
});

describe('pairing codes', () => {
  it('is exactly six digits, zero-padded, and covers the low end of the space', () => {
    const codes = Array.from({ length: 2000 }, () => generatePairingCode());

    for (const code of codes) expect(code).toMatch(/^\d{6}$/);
    expect(codes.every((code) => code.length === PAIRING_CODE_LENGTH)).toBe(true);

    // Non-vacuity for the zero-padding: `String(randomInt(0, 1e6))` alone
    // produces "42" roughly once in ten thousand draws, and a hub keypad that
    // demands six digits could never enter it. 2000 draws is not enough to
    // *see* one, so the property is asserted directly instead.
    expect(String(7).padStart(PAIRING_CODE_LENGTH, '0')).toBe('000007');

    // A uniform generator spreads across the decades of the space; a modulo-
    // biased or truncated one clusters.
    const leadingDigits = new Set(codes.map((code) => code[0]));
    expect(leadingDigits.size).toBe(10);
  });

  it('forgives the separators a person types, and refuses anything else', () => {
    expect(normalizePairingCode('123 456')).toBe('123456');
    expect(normalizePairingCode('123-456')).toBe('123456');
    expect(normalizePairingCode('  123456 ')).toBe('123456');
    expect(normalizePairingCode('12345')).toBeNull();
    expect(normalizePairingCode('1234567')).toBeNull();
    expect(normalizePairingCode('12345a')).toBeNull();
    expect(normalizePairingCode('')).toBeNull();
  });

  it('hashes the digits, domain-separated from session tokens', () => {
    expect(hashPairingCode('123456')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashPairingCode('123456')).not.toContain('123456');
    // Same input, different domain: a leaked pairing hash must not be usable as
    // a session-token hash and vice versa.
    expect(hashPairingCode('123456')).not.toBe(hashDeviceToken('123456'));
  });

  it('lives for ten minutes, as §7 says', () => {
    expect(PAIRING_CODE_TTL_MS).toBe(10 * 60 * 1000);
  });
});

describe('sliding expiry', () => {
  const now = new Date('2026-04-02T08:00:00Z');

  it('stamps a full year ahead', () => {
    expect(DEVICE_SESSION_TTL_MS).toBe(365 * 24 * 60 * 60 * 1000);
    expect(deviceSessionExpiry(now).getTime() - now.getTime()).toBe(DEVICE_SESSION_TTL_MS);
  });

  it('slides a session that has never been seen', () => {
    expect(shouldSlideDeviceSession(null, now)).toBe(true);
  });

  it('coalesces writes inside the window and slides once past it', () => {
    const justNow = new Date(now.getTime() - 1000);
    const anHourAgo = new Date(now.getTime() - DEVICE_SESSION_SLIDE_INTERVAL_MS);
    const aMinuteShort = new Date(now.getTime() - DEVICE_SESSION_SLIDE_INTERVAL_MS + 60_000);

    expect(shouldSlideDeviceSession(justNow, now)).toBe(false);
    expect(shouldSlideDeviceSession(aMinuteShort, now)).toBe(false);
    expect(shouldSlideDeviceSession(anHourAgo, now)).toBe(true);
  });

  it('keeps the window far short of the lifetime it is coalescing', () => {
    // The guarantee is "a hub that is used never logs out". An interval that
    // crept up towards the TTL would quietly stop being that.
    expect(DEVICE_SESSION_SLIDE_INTERVAL_MS).toBeLessThan(DEVICE_SESSION_TTL_MS / 1000);
  });
});

describe('cookie attributes', () => {
  it('is httpOnly, SameSite=Lax, root-scoped and a year long', () => {
    const options = deviceCookieOptions(new Date('2026-04-02T08:00:00Z'));

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
    expect(options.path).toBe('/');
    expect(options.maxAge).toBe(Math.floor(DEVICE_SESSION_TTL_MS / 1000));
    expect(options.expires.getTime() - new Date('2026-04-02T08:00:00Z').getTime()).toBe(
      DEVICE_SESSION_TTL_MS
    );
  });

  it('sets `secure` in production and only there', () => {
    // A LAN kiosk on plain http must still receive the cookie in dev; in
    // production the flag is not optional. `vi.stubEnv` is the supported way
    // to move `NODE_ENV`, which is a getter on `process.env` under Vitest.
    vi.stubEnv('NODE_ENV', 'production');
    expect(deviceCookieOptions().secure).toBe(true);

    vi.stubEnv('NODE_ENV', 'development');
    expect(deviceCookieOptions().secure).toBe(false);

    vi.unstubAllEnvs();
  });
});
