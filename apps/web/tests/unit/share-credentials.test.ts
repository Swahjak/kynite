import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  SHARE_TOKEN_BYTES,
  SHARE_TOKEN_LENGTH,
  SHARE_USE_COALESCE_MS,
  generateShareToken,
  hashShareToken,
  isShareTokenShaped,
  shareUrlFor,
} from '@/lib/share-token';
import { hashDeviceToken } from '@/lib/device-session';
import {
  SHARE_SURFACES,
  SHARE_SURFACE_CHOICES,
  coversCalendar,
  coversMember,
  normalizeScope,
  opensSurface,
  shareLinkStateOf,
  shouldCountShareUse,
} from '@/modules/sharing/domain/scope';
import { QR_QUIET_ZONE, qrPathFor, qrSymbolFor, qrViewBoxSize } from '@/modules/sharing/domain/qr';

/**
 * The pure half of M13: the credential primitives, the scope algebra and the
 * QR encoder. Everything here runs without a database, which is what makes the
 * *token hygiene* properties cheap enough to assert exhaustively.
 */

describe('share tokens', () => {
  it('is 32 bytes of entropy, base64url', () => {
    const token = generateShareToken();

    expect(token).toHaveLength(SHARE_TOKEN_LENGTH);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(SHARE_TOKEN_BYTES);
  });

  it('never repeats — a thousand draws, a thousand values', () => {
    const tokens = new Set(Array.from({ length: 1000 }, generateShareToken));
    expect(tokens.size).toBe(1000);
  });

  it('hashes with a domain separator, so a share hash is not a device hash', () => {
    const token = generateShareToken();

    expect(hashShareToken(token)).toBe(createHash('sha256').update(`share:${token}`).digest('hex'));
    // The property that matters: the same raw secret presented to the two
    // credential systems produces two unrelated digests, so a leaked
    // `device_session.token_hash` can never be looked up in `share_link`.
    expect(hashShareToken(token)).not.toBe(hashDeviceToken(token));
  });

  it('is a one-way function — the hash carries nothing of the token', () => {
    const token = generateShareToken();
    const hash = hashShareToken(token);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Not a substring, not base64 of it, not reversed — the raw value is not
    // recoverable from what gets stored, which is the M13 criterion in its
    // smallest form.
    expect(hash).not.toContain(token);
    expect(hash).not.toContain(Buffer.from(token, 'base64url').toString('hex'));
    expect(Buffer.from(hash, 'hex').toString('base64url')).not.toContain(token);
  });

  it('is deterministic, so a resolver can match on it', () => {
    const token = generateShareToken();
    expect(hashShareToken(token)).toBe(hashShareToken(token));
    expect(hashShareToken(token)).not.toBe(hashShareToken(generateShareToken()));
  });

  it('rejects malformed segments before any database work', () => {
    expect(isShareTokenShaped(generateShareToken())).toBe(true);
    expect(isShareTokenShaped('')).toBe(false);
    expect(isShareTokenShaped('short')).toBe(false);
    expect(isShareTokenShaped('a'.repeat(SHARE_TOKEN_LENGTH + 1))).toBe(false);
    // base64url has no `+`, `/` or `=`; a value carrying them is not one of ours.
    expect(isShareTokenShaped(`${'a'.repeat(SHARE_TOKEN_LENGTH - 1)}+`)).toBe(false);
    expect(isShareTokenShaped(`${'a'.repeat(SHARE_TOKEN_LENGTH - 1)}=`)).toBe(false);
    expect(isShareTokenShaped('../'.repeat(14) + 'a')).toBe(false);
  });

  it('builds a locale-prefixed absolute URL, trailing slash or not', () => {
    expect(shareUrlFor('https://kynite.test', 'nl', 'TOKEN')).toBe(
      'https://kynite.test/nl/s/TOKEN'
    );
    expect(shareUrlFor('https://kynite.test/', 'en', 'TOKEN')).toBe(
      'https://kynite.test/en/s/TOKEN'
    );
  });
});

describe('share scope', () => {
  it('drops empty arrays rather than storing "scoped to nobody"', () => {
    // The distinction the whole scope algebra rests on: `undefined` is
    // unrestricted, `[]` would be a link that shows nothing forever.
    expect(normalizeScope({ memberIds: [], calendarIds: [], surfaces: [] })).toEqual({});
    expect(normalizeScope(null)).toEqual({});
    expect(normalizeScope(undefined)).toEqual({});
  });

  it('deduplicates and drops a full surface selection', () => {
    expect(normalizeScope({ memberIds: ['a', 'a', 'b'] })).toEqual({ memberIds: ['a', 'b'] });
    // Every surface selected says the same thing as none selected.
    expect(normalizeScope({ surfaces: [...SHARE_SURFACES] })).toEqual({});
    expect(normalizeScope({ surfaces: ['calendar'] })).toEqual({ surfaces: ['calendar'] });
  });

  it('drops surfaces that are not in the vocabulary', () => {
    expect(normalizeScope({ surfaces: ['calendar', 'nonsense'] as never })).toEqual({
      surfaces: ['calendar'],
    });
  });

  it('treats an absent dimension as unrestricted', () => {
    expect(coversMember({}, 'anyone')).toBe(true);
    expect(coversCalendar({}, null)).toBe(true);
    expect(opensSurface({}, 'calendar')).toBe(true);
  });

  it('restricts members to the listed ones', () => {
    const scope = { memberIds: ['in'] };
    expect(coversMember(scope, 'in')).toBe(true);
    expect(coversMember(scope, 'out')).toBe(false);
  });

  it('fails closed on an event with no calendar when calendars are restricted', () => {
    const scope = { calendarIds: ['cal-1'] };
    expect(coversCalendar(scope, 'cal-1')).toBe(true);
    expect(coversCalendar(scope, 'cal-2')).toBe(false);
    // A native event has no calendar to test the restriction against. Untestable
    // is not unrestricted — the same reading `authorize.decide()` gives.
    expect(coversCalendar(scope, null)).toBe(false);
  });

  it('offers only the surfaces M13 can actually render', () => {
    for (const surface of SHARE_SURFACE_CHOICES) {
      expect(SHARE_SURFACES).toContain(surface);
    }
    expect([...SHARE_SURFACE_CHOICES]).toEqual(['calendar', 'routines']);
  });
});

describe('share link lifecycle', () => {
  const now = new Date('2026-08-07T12:00:00Z');

  it('is active with no expiry and no revocation', () => {
    expect(shareLinkStateOf({ expiresAt: null, revokedAt: null }, now)).toBe('active');
  });

  it('expires at the boundary, not after it', () => {
    expect(shareLinkStateOf({ expiresAt: now, revokedAt: null }, now)).toBe('expired');
    expect(shareLinkStateOf({ expiresAt: new Date(now.getTime() + 1), revokedAt: null }, now)).toBe(
      'active'
    );
  });

  it('reports revoked even after the expiry passes — that is the fact a parent acted on', () => {
    expect(
      shareLinkStateOf(
        { expiresAt: new Date(now.getTime() - 1000), revokedAt: new Date(now.getTime() - 2000) },
        now
      )
    ).toBe('revoked');
  });
});

describe('share usage telemetry', () => {
  const now = new Date('2026-08-07T12:00:00Z');

  it('counts a first-ever visit', () => {
    expect(shouldCountShareUse(null, now, SHARE_USE_COALESCE_MS)).toBe(true);
  });

  it('coalesces the requests inside one visit', () => {
    const justNow = new Date(now.getTime() - 1000);
    expect(shouldCountShareUse(justNow, now, SHARE_USE_COALESCE_MS)).toBe(false);
  });

  it('counts a return visit once the window has passed', () => {
    const earlier = new Date(now.getTime() - SHARE_USE_COALESCE_MS);
    expect(shouldCountShareUse(earlier, now, SHARE_USE_COALESCE_MS)).toBe(true);
  });
});

describe('QR encoding', () => {
  const url = 'https://kynite.test/nl/s/2XZ1qsSPBLc0y2i8s8OXY0N2gZ2mLcQOgVaVsGxOaWo';

  it('produces a square symbol of a legal QR size', () => {
    const symbol = qrSymbolFor(url);

    // Every QR version is 21 + 4*(v-1) modules on a side.
    expect((symbol.count - 21) % 4).toBe(0);
    expect(symbol.matrix).toHaveLength(symbol.count);
    for (const row of symbol.matrix) expect(row).toHaveLength(symbol.count);
  });

  it('places the three finder patterns', () => {
    const { matrix, count } = qrSymbolFor(url);

    // A finder is a 7x7 dark ring, a 1-module light gap, and a 3x3 dark core.
    // Walking the centre column of each of the three of them — dark, light,
    // dark — is the cheapest assertion that this is a QR symbol at all rather
    // than an arbitrary grid of booleans.
    for (const [row, col] of [
      [3, 3],
      [3, count - 4],
      [count - 4, 3],
    ]) {
      expect(matrix[row][col], `finder core at ${row},${col}`).toBe(true);
      expect(matrix[row - 3][col], `finder ring at ${row - 3},${col}`).toBe(true);
      expect(matrix[row - 2][col], `finder gap at ${row - 2},${col}`).toBe(false);
      expect(matrix[row - 1][col], `finder core edge at ${row - 1},${col}`).toBe(true);
    }

    // The timing pattern: row 6 and column 6 alternate dark/light between the
    // finders, and a scanner uses them to work out the module pitch. Pinning
    // both is a second, independent structural check — a grid that has finders
    // but no timing pattern is not a symbol anything will read.
    for (let index = 8; index < count - 8; index += 1) {
      expect(matrix[6][index], `timing row at col ${index}`).toBe(index % 2 === 0);
      expect(matrix[index][6], `timing column at row ${index}`).toBe(index % 2 === 0);
    }
  });

  it('encodes different URLs to different symbols', () => {
    const a = qrPathFor(qrSymbolFor(`${url}A`));
    const b = qrPathFor(qrSymbolFor(`${url}B`));
    expect(a).not.toBe(b);
  });

  it('emits a viewBox with a quiet zone on both sides', () => {
    const symbol = qrSymbolFor(url);
    expect(qrViewBoxSize(symbol)).toBe(symbol.count + QR_QUIET_ZONE * 2);
  });

  it('merges horizontal runs into one subpath each', () => {
    const symbol = qrSymbolFor(url);
    const path = qrPathFor(symbol);

    const subpaths = path.match(/M/g)?.length ?? 0;
    const darkModules = symbol.matrix.flat().filter(Boolean).length;

    expect(subpaths).toBeGreaterThan(0);
    // One rect per dark module would be the naive rendering; run-merging must
    // beat it, or the DOM carries several hundred elements for nothing.
    expect(subpaths).toBeLessThan(darkModules);
    expect(path).toMatch(/^M\d+ \d+h\d+v1h-\d+z/);
  });

  it('offsets every subpath by the quiet zone', () => {
    // A symbol drawn at 0,0 inside a padded viewBox would sit in the corner
    // with the quiet zone all on one side, which scanners do not forgive.
    const path = qrPathFor(qrSymbolFor(url));
    const firstMove = path.match(/^M(\d+) (\d+)/);

    expect(firstMove).not.toBeNull();
    expect(Number(firstMove![1])).toBeGreaterThanOrEqual(QR_QUIET_ZONE);
    expect(Number(firstMove![2])).toBeGreaterThanOrEqual(QR_QUIET_ZONE);
  });
});
