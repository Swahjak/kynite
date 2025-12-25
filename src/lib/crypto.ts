import { timingSafeEqual } from "crypto";

/**
 * Constant-time string comparison to prevent timing attacks.
 * Returns true if strings are equal, false otherwise.
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
