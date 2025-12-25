import { encryptStringSync, decryptStringSync } from "@47ng/cloak";

const CLOAK_PREFIX = "v1.aesgcm256.";

/**
 * Get the encryption key from environment.
 * Throws if not configured.
 */
function getKey(): string {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is required. Generate with: pnpm dlx @47ng/cloak generate"
    );
  }
  return key;
}

/**
 * Encrypt a token for storage.
 * Uses AES-256-GCM with random IV.
 */
export function encryptToken(token: string): string {
  return encryptStringSync(token, getKey());
}

/**
 * Decrypt a stored token.
 * Throws if decryption fails (invalid key or corrupted data).
 */
export function decryptToken(encrypted: string): string {
  return decryptStringSync(encrypted, getKey());
}

/**
 * Check if a value appears to be encrypted.
 * Uses cloak's ciphertext format detection.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(CLOAK_PREFIX);
}
