/**
 * Family membership cookie management
 *
 * This cookie is a flag to enable fast middleware checks.
 * The actual family membership data comes from the database.
 */

import { cookies } from "next/headers";

export const FAMILY_COOKIE_NAME = "has-family";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Set the family membership cookie
 * Call this when a user successfully joins or creates a family
 */
export async function setFamilyCookie() {
  const cookieStore = await cookies();
  cookieStore.set(FAMILY_COOKIE_NAME, "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

/**
 * Clear the family membership cookie
 * Call this when a user leaves their family
 */
export async function clearFamilyCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(FAMILY_COOKIE_NAME);
}

/**
 * Check if the family membership cookie exists
 * Used for server-side checks in Server Components
 */
export async function hasFamilyCookie(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(FAMILY_COOKIE_NAME)?.value === "true";
}
