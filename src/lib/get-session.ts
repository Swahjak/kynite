import { headers } from "next/headers";
import { auth } from "@/server/auth";

/**
 * Get the current user session from the server
 * Use this in Server Components and Route Handlers
 * Session includes familyId from customSession plugin
 */
export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session;
}

/**
 * Get the current user from the session
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  const session = await getSession();
  return session?.user || null;
}

/**
 * Get the current user's familyId from session
 * Returns null if not authenticated or no family
 */
export async function getCurrentFamilyId() {
  const session = await getSession();
  return session?.session?.familyId || null;
}

/**
 * Require authentication - throws redirect if not authenticated
 * Use in Server Components that require auth
 */
export async function requireAuth() {
  const session = await getSession();

  if (!session?.user) {
    // This will be caught by error boundary or redirect
    throw new Error("Unauthorized");
  }

  return session;
}
