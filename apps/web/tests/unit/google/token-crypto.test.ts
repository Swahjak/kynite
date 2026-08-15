import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  TOKEN_CIPHER_VERSION,
  TokenCryptoError,
  decryptToken,
  encryptToken,
  isEncryptedToken,
  parseEncryptionKey,
  safeEqual,
} from '@/modules/google/crypto';
import { createEchoRegistry } from '@/modules/google/domain/echo';
import { googleEventIdFor } from '@/modules/google/domain/ids';

/**
 * Token encryption at rest (docs/architecture.md §5) and the versioned
 * ciphertext prefix that makes key rotation possible later (risk §11.5).
 */

const key = randomBytes(32);
const REFRESH_TOKEN = '1//0gW3xamplerefreshtoken-abcdefghijklmnop';

describe('encryptToken / decryptToken', () => {
  it('round-trips a refresh token', () => {
    expect(decryptToken(encryptToken(REFRESH_TOKEN, key), key)).toBe(REFRESH_TOKEN);
  });

  it('emits a versioned envelope, never the plaintext', () => {
    const envelope = encryptToken(REFRESH_TOKEN, key);

    expect(envelope.startsWith(`${TOKEN_CIPHER_VERSION}:`)).toBe(true);
    expect(envelope.split(':')).toHaveLength(4);
    expect(envelope).not.toContain(REFRESH_TOKEN);
    expect(isEncryptedToken(envelope)).toBe(true);
    expect(isEncryptedToken(REFRESH_TOKEN)).toBe(false);
  });

  it('uses a fresh IV per encryption', () => {
    expect(encryptToken(REFRESH_TOKEN, key)).not.toBe(encryptToken(REFRESH_TOKEN, key));
  });

  it('refuses a tampered ciphertext (AES-GCM is authenticated)', () => {
    const [version, iv, ciphertext, tag] = encryptToken(REFRESH_TOKEN, key).split(':');
    const flipped = Buffer.from(ciphertext, 'base64');
    flipped[0] ^= 0xff;

    expect(() =>
      decryptToken([version, iv, flipped.toString('base64'), tag].join(':'), key)
    ).toThrow(TokenCryptoError);
  });

  it('refuses the wrong key', () => {
    const envelope = encryptToken(REFRESH_TOKEN, key);
    expect(() => decryptToken(envelope, randomBytes(32))).toThrow(TokenCryptoError);
  });

  it('gives a wrong key and a tampered ciphertext the identical error message (N9)', () => {
    // decryptToken() deliberately swallows the underlying OpenSSL error (see
    // its source comment: "bad tag" vs "bad key" is an oracle we have no
    // reason to hand out). Pin that the two failure modes are genuinely
    // indistinguishable from the outside, not just "both throw".
    const envelope = encryptToken(REFRESH_TOKEN, key);

    const [version, iv, ciphertext, tag] = envelope.split(':');
    const flipped = Buffer.from(ciphertext, 'base64');
    flipped[0] ^= 0xff;
    const tamperedEnvelope = [version, iv, flipped.toString('base64'), tag].join(':');

    let wrongKeyMessage = '';
    try {
      decryptToken(envelope, randomBytes(32));
    } catch (error) {
      wrongKeyMessage = (error as Error).message;
    }

    let tamperedMessage = '';
    try {
      decryptToken(tamperedEnvelope, key);
    } catch (error) {
      tamperedMessage = (error as Error).message;
    }

    expect(wrongKeyMessage).not.toBe('');
    expect(wrongKeyMessage).toBe(tamperedMessage);
  });

  it('refuses an unknown ciphertext version, so rotation cannot silently fail', () => {
    const envelope = encryptToken(REFRESH_TOKEN, key).replace(/^v1:/, 'v2:');
    expect(() => decryptToken(envelope, key)).toThrow(/unsupported ciphertext version/);
  });

  it('refuses a malformed envelope', () => {
    expect(() => decryptToken('not-an-envelope', key)).toThrow(/malformed/);
  });
});

describe('parseEncryptionKey', () => {
  it('accepts a 32-byte base64 key', () => {
    expect(parseEncryptionKey(randomBytes(32).toString('base64'))).toHaveLength(32);
  });

  it('rejects a short key rather than padding it', () => {
    expect(() => parseEncryptionKey(randomBytes(16).toString('base64'))).toThrow(TokenCryptoError);
  });
});

describe('safeEqual', () => {
  it('compares equal and unequal secrets', () => {
    expect(safeEqual('channel-token', 'channel-token')).toBe(true);
    expect(safeEqual('channel-token', 'channel-toker')).toBe(false);
    // Different lengths must not throw (timingSafeEqual would).
    expect(safeEqual('short', 'a-much-longer-value')).toBe(false);
  });
});

describe('echo registry', () => {
  it('remembers our etags and forgets them after the TTL', () => {
    let now = 1_000;
    const registry = createEchoRegistry({ ttlMs: 500, now: () => now });

    registry.record('"etag-1"');
    expect(registry.isOwn('"etag-1"')).toBe(true);

    now += 501;
    expect(registry.isOwn('"etag-1"')).toBe(false);
    expect(registry.size).toBe(0);
  });

  it('never treats a missing etag as ours', () => {
    const registry = createEchoRegistry();
    registry.record(null);
    expect(registry.isOwn(null)).toBe(false);
    expect(registry.isOwn(undefined)).toBe(false);
  });

  it('stays bounded under a busy sync', () => {
    const registry = createEchoRegistry({ maxEntries: 10 });
    for (let index = 0; index < 100; index += 1) registry.record(`"etag-${index}"`);
    expect(registry.size).toBeLessThanOrEqual(10);
  });
});

describe('caller-assigned Google event ids', () => {
  it('derives a valid base32hex id from a uuid', () => {
    const id = googleEventIdFor('33333333-3333-4333-8333-333333333333');
    expect(id).toMatch(/^[0-9a-v]{5,1024}$/);
  });

  it('is deterministic — the whole point of retry safety', () => {
    const uuid = '44444444-4444-4444-8444-444444444444';
    expect(googleEventIdFor(uuid)).toBe(googleEventIdFor(uuid));
  });
});
