import { createDecipheriv, createCipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * OAuth token encryption at rest (docs/architecture.md §5 "Tokens encrypted at
 * rest", risk §11.5 "version the ciphertext prefix now so rotation is
 * possible later").
 *
 * Format: `v1:<iv-b64>:<ciphertext-b64>:<tag-b64>`
 *
 * - **AES-256-GCM**, so the ciphertext is authenticated: a tampered row fails
 *   to decrypt rather than yielding a wrong-but-plausible token.
 * - **12-byte random IV per encryption** — the GCM standard nonce size; never
 *   derived from the plaintext, so encrypting the same refresh token twice
 *   produces different ciphertext.
 * - **The `v1:` prefix is the rotation seam.** A future `v2:` (new KDF, new
 *   cipher, envelope encryption) can be introduced while `decrypt()` still
 *   reads `v1:` rows, so rotation is a background re-encrypt rather than a
 *   flag day.
 *
 * Pure and framework-free: the key is an argument, never an env read, so the
 * unit suite exercises exactly the code the server runs.
 */

export const TOKEN_CIPHER_VERSION = 'v1';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

export class TokenCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenCryptoError';
  }
}

/** Decodes and validates a base64 AES-256 key. */
export function parseEncryptionKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new TokenCryptoError(
      `TOKEN_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}`
    );
  }
  return key;
}

/** `plaintext` → `v1:iv:ciphertext:tag`. */
export function encryptToken(plaintext: string, key: Buffer): string {
  if (key.length !== KEY_BYTES) throw new TokenCryptoError('invalid key length');

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    TOKEN_CIPHER_VERSION,
    iv.toString('base64'),
    ciphertext.toString('base64'),
    tag.toString('base64'),
  ].join(':');
}

/** `v1:iv:ciphertext:tag` → plaintext. Throws on tampering or a wrong key. */
export function decryptToken(envelope: string, key: Buffer): string {
  if (key.length !== KEY_BYTES) throw new TokenCryptoError('invalid key length');

  const parts = envelope.split(':');
  if (parts.length !== 4) throw new TokenCryptoError('malformed ciphertext envelope');

  const [version, ivB64, ciphertextB64, tagB64] = parts;
  if (version !== TOKEN_CIPHER_VERSION) {
    throw new TokenCryptoError(`unsupported ciphertext version "${version}"`);
  }

  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  if (iv.length !== IV_BYTES) throw new TokenCryptoError('malformed iv');

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // Never surface the underlying OpenSSL message: it differs between "bad
    // tag" and "bad key", which is an oracle we have no reason to hand out.
    throw new TokenCryptoError('could not decrypt token (wrong key or tampered ciphertext)');
  }
}

/** True when `envelope` is one of ours — used to spot un-migrated plaintext. */
export function isEncryptedToken(envelope: string | null | undefined): boolean {
  return typeof envelope === 'string' && envelope.startsWith(`${TOKEN_CIPHER_VERSION}:`);
}

/** Constant-time string compare for channel tokens and other shared secrets. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
