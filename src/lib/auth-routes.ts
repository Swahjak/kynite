/**
 * Authentication route configuration
 * Defines which routes are public vs protected
 */

// Routes that don't require authentication
export const publicRoutes = ["/", "/login"] as const;

// Auth API routes (always public)
export const authApiPrefix = "/api/auth";

// Route to redirect unauthenticated users to
export const loginRoute = "/login";

// Route to redirect authenticated users to after login
export const defaultAuthRedirect = "/calendar";

// Route for family onboarding
export const onboardingRoute = "/onboarding";

// Routes that allow unauthenticated access for invite links
// (will redirect to login, then back to invite)
export const inviteRoutes = ["/join"] as const;

/**
 * Check if a pathname is a public route
 * Handles locale prefixes (e.g., /en/login, /nl/signup)
 */
export function isPublicRoute(pathname: string): boolean {
  // Remove locale prefix if present
  const pathWithoutLocale = pathname.replace(/^\/(en|nl)/, "") || "/";

  return (
    publicRoutes.some((route) => {
      if (route === "/") {
        return pathWithoutLocale === "/";
      }
      return pathWithoutLocale.startsWith(route);
    }) || inviteRoutes.some((route) => pathWithoutLocale.startsWith(route))
  );
}

/**
 * Check if a pathname is an auth API route
 */
export function isAuthApiRoute(pathname: string): boolean {
  return pathname.startsWith(authApiPrefix);
}
