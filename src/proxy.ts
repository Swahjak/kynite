import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import {
  isPublicRoute,
  isAuthApiRoute,
  loginRoute,
  isHomepage,
} from "@/lib/auth-routes";
import { ErrorCode } from "@/lib/errors/codes";

// Create next-intl middleware for locale handling
const intlMiddleware = createIntlMiddleware(routing);

// Origins allowed for API requests
const ALLOWED_ORIGINS = [
  process.env.BETTER_AUTH_URL,
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
].filter(Boolean);

// Paths exempt from Content-Type and Origin validation
const API_SECURITY_EXEMPT_PATHS = [
  "/api/cron/",
  "/api/webhooks/",
  "/api/auth/",
  "/api/pusher/", // Pusher sends form-urlencoded, not JSON
  "/api/test/", // E2E test endpoints
];

function createApiErrorResponse(
  code: ErrorCode,
  status: number,
  details?: unknown
) {
  return NextResponse.json(
    { success: false, error: { code, details } },
    { status }
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip proxy for static files and Next.js internals
  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // Payload CMS routes - apply CSRF protection to API
  if (pathname.startsWith("/cms")) {
    // Admin panel (React SPA) - pass through
    if (pathname.startsWith("/cms/admin")) {
      return NextResponse.next();
    }

    // CMS API - CSRF protection on mutating requests
    if (pathname.startsWith("/cms/api/")) {
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
        // Origin validation
        const origin = request.headers.get("origin");
        if (!origin) {
          return createApiErrorResponse(
            ErrorCode.FORBIDDEN,
            403,
            "Missing Origin header"
          );
        }

        try {
          const originUrl = new URL(origin);
          const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
            if (!allowed) return false;
            const allowedUrl = new URL(allowed);
            return originUrl.host === allowedUrl.host;
          });

          if (!isAllowed) {
            return createApiErrorResponse(
              ErrorCode.FORBIDDEN,
              403,
              "Invalid Origin"
            );
          }
        } catch {
          return createApiErrorResponse(
            ErrorCode.FORBIDDEN,
            403,
            "Invalid Origin format"
          );
        }

        // Content-Type whitelist (JSON, multipart uploads, form posts)
        const contentType = request.headers.get("content-type") || "";
        const validTypes = [
          "application/json",
          "multipart/form-data",
          "application/x-www-form-urlencoded",
        ];
        if (!validTypes.some((t) => contentType.includes(t))) {
          return createApiErrorResponse(
            ErrorCode.BAD_REQUEST,
            415,
            "Invalid Content-Type"
          );
        }
      }
    }

    return NextResponse.next();
  }

  // Handle help docs (Nextra handles its own i18n)
  if (pathname.startsWith("/help")) {
    // Redirect /help to /help/{locale} based on user preference
    if (pathname === "/help" || pathname === "/help/") {
      const acceptLanguage = request.headers.get("accept-language") || "";
      const prefersDutch = acceptLanguage.toLowerCase().includes("nl");
      const locale = prefersDutch ? "nl" : "en";
      return NextResponse.redirect(new URL(`/help/${locale}`, request.url));
    }
    return NextResponse.next();
  }

  // Handle API routes with security validation
  if (pathname.startsWith("/api/")) {
    // Skip auth endpoints (better-auth handles its own security)
    if (pathname.startsWith("/api/auth/")) {
      return NextResponse.next();
    }

    // Apply security validation to mutating API requests
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      const isExempt = API_SECURITY_EXEMPT_PATHS.some((path) =>
        pathname.startsWith(path)
      );

      if (!isExempt) {
        // Validate Content-Type for requests with body
        if (["POST", "PUT", "PATCH"].includes(request.method)) {
          const contentType = request.headers.get("content-type");
          const hasJsonContentType =
            contentType?.includes("application/json") ?? false;

          if (!hasJsonContentType) {
            return createApiErrorResponse(
              ErrorCode.BAD_REQUEST,
              415,
              "Content-Type must be application/json"
            );
          }
        }

        // Validate Origin header
        const origin = request.headers.get("origin");
        if (!origin) {
          return createApiErrorResponse(
            ErrorCode.FORBIDDEN,
            403,
            "Missing Origin header"
          );
        }

        // Validate origin is allowed
        try {
          const originUrl = new URL(origin);
          const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
            if (!allowed) return false;
            const allowedUrl = new URL(allowed);
            return originUrl.host === allowedUrl.host;
          });

          if (!isAllowed) {
            return createApiErrorResponse(
              ErrorCode.FORBIDDEN,
              403,
              "Invalid Origin"
            );
          }
        } catch {
          return createApiErrorResponse(
            ErrorCode.FORBIDDEN,
            403,
            "Invalid Origin format"
          );
        }
      }
    }

    return NextResponse.next();
  }

  // Check if route is public
  if (isPublicRoute(pathname) || isAuthApiRoute(pathname)) {
    // Redirect authenticated users from homepage to dashboard
    if (isHomepage(pathname)) {
      const sessionCookie =
        request.cookies.get("__Secure-better-auth.session_token") ||
        request.cookies.get("better-auth.session_token");

      if (sessionCookie?.value) {
        // Extract locale from path, default to 'nl' if not present
        const localeMatch = pathname.match(/^\/(en|nl)/);
        const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
        return NextResponse.redirect(
          new URL(`/${locale}/dashboard`, request.url)
        );
      }
    }

    // Apply intl middleware for locale handling
    return intlMiddleware(request);
  }

  // For protected routes, check authentication
  // Better-Auth stores session in cookies
  // Note: Cookie name has __Secure- prefix on HTTPS (production)
  const sessionCookie =
    request.cookies.get("__Secure-better-auth.session_token") ||
    request.cookies.get("better-auth.session_token");

  if (!sessionCookie?.value) {
    // No session - redirect to login
    const loginUrl = new URL(loginRoute, request.url);
    // Preserve the original URL to redirect back after login
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // User has session cookie - apply intl middleware and continue
  // Family membership check happens in layouts, not proxy
  return intlMiddleware(request);
}

export const config = {
  // Match all routes except static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
