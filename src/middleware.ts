import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import {
  isPublicRoute,
  isAuthApiRoute,
  loginRoute,
  onboardingRoute,
  isFamilyRequiredRoute,
} from "@/lib/auth-routes";

// Family cookie name (must match family-cookie.ts)
const FAMILY_COOKIE_NAME = "has-family";

// Create next-intl middleware
const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.includes(".") // Static files like favicon.ico
  ) {
    return NextResponse.next();
  }

  // Allow API routes through (they handle their own auth)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Check if route is public
  if (isPublicRoute(pathname) || isAuthApiRoute(pathname)) {
    // Apply intl middleware for locale handling
    return intlMiddleware(request);
  }

  // For protected routes, check authentication
  // Better-Auth stores session in cookies
  const sessionCookie = request.cookies.get("better-auth.session_token");

  if (!sessionCookie?.value) {
    // No session - redirect to login
    const loginUrl = new URL(loginRoute, request.url);
    // Preserve the original URL to redirect back after login
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For family-required routes, check family membership cookie
  if (isFamilyRequiredRoute(pathname)) {
    const hasFamilyCookie = request.cookies.get(FAMILY_COOKIE_NAME);

    if (!hasFamilyCookie?.value) {
      // Redirect to onboarding
      const locale = pathname.match(/^\/(en|nl)/)?.[1] || "nl";
      const onboardingUrl = new URL(
        `/${locale}${onboardingRoute}`,
        request.url
      );
      return NextResponse.redirect(onboardingUrl);
    }
  }

  // User has session cookie - apply intl middleware and continue
  return intlMiddleware(request);
}

export const config = {
  // Match all routes except static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
