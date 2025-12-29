# CMS CSRF Protection Design

**Goal:** Add CSRF protection to PayloadCMS API routes (`/cms/api/*`) matching the security model of the main app's API routes.

**Architecture:** Extend proxy.ts to validate Origin header and Content-Type whitelist on mutating requests to `/cms/api/*`. Admin panel (`/cms/admin/*`) passes through unchanged since it's a React SPA that calls the API.

---

## Security Model

### Protected Routes

- `/cms/api/*` - All PayloadCMS REST and GraphQL endpoints

### Unprotected Routes

- `/cms/admin/*` - Admin panel HTML/JS (read-only, no sensitive operations)

### Validation Rules (POST/PUT/PATCH/DELETE only)

1. **Origin Header Required**
   - Must be present
   - Must match allowed origins (`BETTER_AUTH_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL`)

2. **Content-Type Whitelist**
   - `application/json` - Standard API calls
   - `multipart/form-data` - Media uploads
   - `application/x-www-form-urlencoded` - Form submissions

---

## Implementation

Single change to `src/proxy.ts`:

```typescript
if (pathname.startsWith("/cms")) {
  // Admin panel - pass through
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

      // Content-Type whitelist
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
```

---

## Testing

1. **Valid request** - POST to `/cms/api/users` with correct Origin and Content-Type → passes through
2. **Missing Origin** - POST to `/cms/api/users` without Origin header → 403
3. **Invalid Origin** - POST from `evil.com` → 403
4. **Invalid Content-Type** - POST with `text/plain` → 415
5. **GET requests** - No validation, pass through
6. **Admin panel** - All requests pass through unchanged
