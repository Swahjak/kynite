import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = [
  process.env.BETTER_AUTH_URL,
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
].filter(Boolean);

export function middleware(request: NextRequest) {
  // Only check mutating requests
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    const origin = request.headers.get("origin");

    // API routes require valid origin
    if (request.nextUrl.pathname.startsWith("/api/")) {
      // Skip for cron endpoints (use auth header instead)
      if (request.nextUrl.pathname.startsWith("/api/cron/")) {
        return NextResponse.next();
      }

      // Skip for webhooks (external services)
      if (request.nextUrl.pathname.startsWith("/api/webhooks/")) {
        return NextResponse.next();
      }

      // Skip for auth endpoints (better-auth handles its own CSRF)
      if (request.nextUrl.pathname.startsWith("/api/auth/")) {
        return NextResponse.next();
      }

      // Require origin header for other API routes
      if (!origin) {
        return NextResponse.json(
          { error: "Missing Origin header" },
          { status: 403 }
        );
      }

      // Validate origin
      const originUrl = new URL(origin);
      const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
        if (!allowed) return false;
        const allowedUrl = new URL(allowed);
        return originUrl.host === allowedUrl.host;
      });

      if (!isAllowed) {
        return NextResponse.json({ error: "Invalid Origin" }, { status: 403 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
