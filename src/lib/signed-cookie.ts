/**
 * Utility for signing cookies compatible with better-auth
 *
 * Better-auth uses HMAC-SHA256 to sign cookie values.
 * Format: {value}.{base64_signature}
 *
 * This replicates the signing logic from better-call to maintain
 * compatibility without depending on internal packages.
 */

const algorithm = {
  name: "HMAC",
  hash: "SHA-256",
} as const;

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const secretBuf = new TextEncoder().encode(secret);
  return await crypto.subtle.importKey("raw", secretBuf, algorithm, false, [
    "sign",
  ]);
}

async function makeSignature(value: string, secret: string): Promise<string> {
  const key = await getCryptoKey(secret);
  const signature = await crypto.subtle.sign(
    algorithm.name,
    key,
    new TextEncoder().encode(value)
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Sign a cookie value in the format better-auth expects
 * @param value - The raw cookie value
 * @param secret - The BETTER_AUTH_SECRET
 * @returns Signed value: {value}.{signature}
 */
export async function signCookieValue(
  value: string,
  secret: string
): Promise<string> {
  const signature = await makeSignature(value, secret);
  return `${value}.${signature}`;
}
