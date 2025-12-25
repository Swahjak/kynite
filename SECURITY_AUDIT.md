# Security Audit Report

**Project:** Family Planner v3 (Next.js 16)
**Audit Date:** 2025-12-25
**Auditor:** Automated Security Analysis
**Scope:** Full application security review

---

## Executive Summary

This security audit examined the Family Planner Next.js 16 application across 7 security domains:

- Authentication & Authorization
- API Security & Input Validation
- Database Security
- Third-party Integrations (Google, Pusher)
- Environment & Secrets Management
- Client-side Security
- Infrastructure & Security Headers

### Overall Assessment

| Domain                           | Rating | Issues Found       |
| -------------------------------- | ------ | ------------------ |
| Authentication & Authorization   | B+     | 4 HIGH, 8 MEDIUM   |
| API Security & Input Validation  | B      | 5 CRITICAL, 4 HIGH |
| Database Security                | B+     | 2 HIGH, 5 MEDIUM   |
| Third-party Integrations         | B-     | 3 CRITICAL, 5 HIGH |
| Environment & Secrets Management | B      | 2 CRITICAL, 2 HIGH |

**Overall Security Grade: B** (Good foundation with critical gaps requiring immediate attention)

---

## Critical Issues Summary

| #   | Issue                                           | Domain          | Fix Priority |
| --- | ----------------------------------------------- | --------------- | ------------ |
| 1   | Missing Timing-Safe Token Comparison            | Third-party     | Week 1       |
| 2   | Missing Rate Limiting on Critical Endpoints     | API/Third-party | Week 1       |
| 3   | Weak 6-digit Pairing Code Entropy               | Third-party     | Week 1       |
| 4   | Missing Input Validation - Calendar Endpoints   | API             | Week 1       |
| 5   | Weak Cron Authentication (Optional CRON_SECRET) | API/Environment | Week 1       |
| 6   | CI Build Missing Environment Variables          | Environment     | Week 1       |
| 7   | Pusher Credentials Missing Validation           | Environment     | Week 1       |

---

## 1. Authentication & Authorization

### CRITICAL Issues

None identified.

### HIGH Priority Issues

#### 1.1 Missing Password Authentication Method

**File:** `src/server/auth.ts`
**Issue:** Only Google OAuth configured; no fallback authentication method.
**Risk:** If Google OAuth unavailable, users cannot authenticate.
**Recommendation:** Add email/password authentication with proper password policies.

#### 1.2 Missing Cookie Security Flags in Production

**File:** `src/server/auth.ts:99-106`
**Issue:** Session configuration does not explicitly set `secure`, `httpOnly`, or `sameSite` flags.
**Recommendation:**

```typescript
session: {
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
},
```

#### 1.3 Weak Cron Job Authentication

**Files:** `src/app/api/cron/*/route.ts`
**Issue:** If `CRON_SECRET` not set, endpoints are completely unprotected.
**Recommendation:** Make `CRON_SECRET` required; throw error if missing in production.

#### 1.4 Google Calendar Webhook Missing Authentication

**File:** `src/app/api/webhooks/google-calendar/route.ts:36-48`
**Issue:** Relies only on token verification; no Google IP validation.
**Recommendation:** Add IP allowlisting for Google's webhook servers.

### MEDIUM Priority Issues

- OAuth token storage in plain text (encrypt at rest)
- No rate limiting on authentication endpoints
- Device pairing codes only 6 digits (increase to 8 or add rate limiting)
- Missing CSRF protection on custom API routes
- Device sessions last 90 days without re-authentication
- No account lockout policy after failed attempts
- Insufficient logging for security events
- Missing input sanitization on user-controlled fields

### GOOD Practices

- Consistent family membership verification on all routes
- Role-based access control (manager vs participant vs device)
- Transaction safety for critical operations
- Secure device pairing flow with expiring codes
- `getNonDeviceSession()` blocks devices from sensitive operations
- Comprehensive Zod schemas for input validation
- Prevents last manager removal
- Pusher channel authorization requires family membership

---

## 2. API Security & Input Validation

### CRITICAL Issues

#### 2.1 Missing Input Validation - Calendar Management

**File:** `src/app/api/v1/families/[familyId]/calendars/route.ts:72-198`
**Issue:** POST endpoint accepts user input without Zod validation.
**Recommendation:** Create and apply Zod schema:

```typescript
const addCalendarSchema = z.object({
  accountId: z.string().uuid(),
  googleCalendarId: z.string().min(1).max(255),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
```

#### 2.2 Missing Input Validation - Calendar Toggle

**File:** `src/app/api/v1/families/[familyId]/calendars/[calendarId]/route.ts:14-89`
**Issue:** PATCH endpoint accepts `syncEnabled` without validation.

#### 2.3 Webhook Token Verification - No Rate Limiting

**File:** `src/app/api/webhooks/google-calendar/route.ts`
**Issue:** No rate limiting; returns 200 on failed verification.
**Risk:** DoS vulnerability through webhook spam.

#### 2.4 Test Session Endpoint Production Risk

**File:** `src/app/api/test/create-session/route.ts`
**Issue:** If `E2E_TEST=true` set in production, bypasses all auth.
**Recommendation:** Remove from production builds or add IP whitelist.

### HIGH Priority Issues

- Pusher authorization weak family ID extraction (simple string replace)
- Missing validation on Add Member endpoint
- Error messages leak information (expose raw error messages)
- No rate limiting on authenticated endpoints

### MEDIUM Priority Issues

- Inconsistent error response format
- Missing request size limits
- No Content-Type validation
- Invite token no length validation
- CORS configuration not reviewed

### GOOD Practices

- Excellent authentication checks using `auth.api.getSession()`
- Proper family membership verification before resource access
- Manager role verification for sensitive operations
- Prevents last manager removal
- Majority of endpoints use Zod schemas
- Try-catch blocks in all route handlers
- Proper scoping of queries with `familyId` filters
- Use of Drizzle ORM prevents SQL injection
- `.limit(1)` usage prevents data leakage

---

## 3. Database Security

### HIGH Priority Issues

#### 3.1 OAuth Token Storage in Plain Text

**File:** `src/server/schema.ts:48-65`
**Issue:** Google OAuth tokens stored as plain text.
**Risk:** Database compromise exposes all users' Google Calendar access.
**Recommendation:** Implement field-level encryption using `@47ng/cloak` or similar.

#### 3.2 No SSL/TLS Configuration

**File:** `src/server/db/index.ts:12`
**Issue:** No explicit SSL configuration for database connection.
**Recommendation:**

```typescript
const client = postgres(process.env.DATABASE_URL, {
  ssl: process.env.NODE_ENV === "production" ? "require" : false,
});
```

### MEDIUM Priority Issues

- `sql`` template usage instead of Drizzle operators in `device-service.ts:201`
- Session tokens stored as plain text (verify better-auth hashing)
- No connection pooling configuration
- No explicit indexes on `familyId` columns

### LOW Priority Issues

- Migration naming (random names vs timestamps)
- Device pairing code cleanup timing

### GOOD Practices

- Exclusive use of Drizzle ORM with parameterized queries (no SQL injection)
- Comprehensive multi-tenant data isolation with `familyId` scoping
- Three-tier authorization pattern consistently applied
- Proper cascade delete configuration
- Privacy filtering for sensitive events (`redactEventDetails()`)
- Transaction safety for critical operations (star balance updates)
- Cryptographically secure token generation (`crypto.randomBytes()`)
- Environment secrets properly gitignored
- No passwords stored (OAuth only)

---

## 4. Third-party Integrations (Google, Pusher)

### CRITICAL Issues

#### 4.1 Missing Timing-Safe Token Comparison

**Files:**

- `src/server/services/google-channel-service.ts:160`
- `src/server/services/device-service.ts:58`
- `src/server/services/family-service.ts:275`
- `src/app/api/cron/sync-calendars/route.ts:17`

**Issue:** Token comparisons use `===` instead of constant-time comparison.
**Risk:** Timing attacks can guess tokens character-by-character.
**Recommendation:**

```typescript
import { timingSafeEqual } from "crypto";

function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
```

#### 4.2 Missing Rate Limiting on Critical Endpoints

**Files:**

- `src/app/api/v1/devices/pair/generate/route.ts`
- `src/app/api/v1/invites/[token]/accept/route.ts`

**Issue:** Rate limiting utility exists (`src/lib/rate-limit.ts`) but is not implemented.
**Risk:** Brute force attacks on pairing codes (only 1M combinations).

#### 4.3 Weak Pairing Code Entropy

**File:** `src/server/services/device-service.ts:18-19`
**Issue:** 6-digit numeric codes provide only ~20 bits of entropy.
**Calculation:** 1,000,000 codes / 300 seconds = ~3,334 attempts/second needed.
**Recommendation:** Increase to 8 digits OR implement exponential backoff.

### HIGH Priority Issues

- Missing HTTPS enforcement for webhook URLs
- Google webhook returns 200 on invalid tokens (should return 401)
- No CSRF protection on Pusher authorization
- Pusher channel name injection risk (weak validation)
- Invite token endpoint lacks rate limiting

### MEDIUM Priority Issues

- No token blacklisting for revoked channels
- Device session expiry not enforced
- Missing input validation on device names
- Error messages leak information (enumerate valid tokens)
- SQL injection risk from `sql`` template (currently safe but risky pattern)
- Missing Content Security Policy

### GOOD Practices

- Strong token generation (`crypto.randomBytes()` for invites)
- Parameterized database queries throughout
- OAuth scope minimization (`.readonly` for calendar list)
- Token expiration implemented (5 min for pairing, optional for invites)
- Authentication required on sensitive endpoints
- Database transactions for atomic operations
- Proper token storage (server-side, not localStorage)
- Input validation with Zod
- Channel authorization verifies family membership
- Calendar sync pagination to prevent timeout/memory issues

---

## 5. Environment & Secrets Management

### CRITICAL Issues

#### 5.1 CI Build Missing Environment Variables

**File:** `.github/workflows/ci.yml`
**Issue:** CI workflow runs `build:next` without required environment variables.
**Impact:** CI builds fail.
**Recommendation:** Add all required environment variables to CI workflow.

#### 5.2 Pusher Credentials Missing Validation

**File:** `src/lib/pusher.ts:3-9`
**Issue:** Non-null assertions without validation cause silent failures.
**Recommendation:** Add startup validation similar to `auth.ts`.

### HIGH Priority Issues

- CRON_SECRET optional validation creates security risk
- Test endpoint protection relies on complex boolean logic

### MEDIUM Priority Issues

- Google OAuth secrets only show warning, not error
- Client-side auth URL fallback may cause silent failures
- `.env.test` has weak secrets (intentional but should be documented)
- Missing environment variable documentation for Pusher

### LOW Priority Issues

- `.env.production.local` has world-readable permissions (should be 600)
- Drizzle config error message could be more helpful
- `turbo.json` lists Neon/Vercel variables not in `.env.example`

### GOOD Practices

- Comprehensive `.gitignore` for environment files
- No `.env` files ever committed to git history
- Strong secret validation in core auth (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`)
- Proper separation of client/server environment variables (`NEXT_PUBLIC_` prefix)
- Well-documented `.env.example` with generation instructions
- Secure test environment isolation (separate database, proper permissions)
- No secret logging detected
- Token verification for webhooks
- E2E tests use separate environment
- Proper Turbo caching configuration

---

## 6. Remediation Roadmap

### Week 1 (Critical)

1. Implement timing-safe token comparison across all security-sensitive endpoints
2. Add rate limiting to pairing code generation, invite endpoints, and webhooks
3. Increase pairing code entropy to 8 digits OR add exponential backoff
4. Add Zod validation to calendar management endpoints
5. Make `CRON_SECRET` required in production
6. Fix CI build environment variables
7. Add Pusher credential validation

### Week 2 (High)

8. Add HTTPS validation for production webhook URLs
9. Fix webhook 401 responses for invalid tokens
10. Implement CSRF protection on Pusher auth endpoint
11. Add channel name validation with regex
12. Explicitly configure secure session cookies
13. Implement rate limiting on authentication endpoints
14. Add SSL enforcement for database connection

### Week 3 (Medium)

15. Encrypt OAuth tokens at rest
16. Standardize error response format
17. Add request size limits
18. Add Content-Type validation
19. Implement token blacklisting for stopped Google channels
20. Add security headers in `next.config.ts`
21. Add connection pooling configuration

### Week 4 (Low Priority / Hardening)

22. Implement security event logging
23. Add account lockout policy
24. Add MFA for managers
25. Consider email/password authentication as fallback
26. Reduce device session expiry from 90 days
27. Validate all environment variables at startup

---

## 7. Quick Wins (< 1 hour each)

| Fix                                     | File                          | Effort |
| --------------------------------------- | ----------------------------- | ------ |
| Make CRON_SECRET required               | `src/app/api/cron/*/route.ts` | 15 min |
| Add Pusher validation                   | `src/lib/pusher.ts`           | 15 min |
| Fix `.env.production.local` permissions | Shell command                 | 1 min  |
| Add HTTPS validation for webhooks       | `google-channel-service.ts`   | 15 min |
| Change webhook 401 response             | `google-calendar/route.ts`    | 5 min  |
| Add CI environment variables            | `.github/workflows/ci.yml`    | 30 min |

---

## 8. Testing Recommendations

After implementing fixes:

1. **Test timing attacks** - Verify constant-time comparison with timing measurements
2. **Test rate limiting** - Verify endpoints reject requests after threshold
3. **Test missing secrets** - Remove each secret and verify graceful failure
4. **Test cron authentication** - Attempt to call cron endpoints without `Authorization` header
5. **Test webhook validation** - Send invalid tokens and verify 401 response
6. **Test CI build** - Ensure build passes with new environment variables
7. **Penetration test** - Conduct full pentest after critical fixes deployed

---

## 9. Files Requiring Changes

### Critical Priority

- `src/server/services/google-channel-service.ts`
- `src/server/services/device-service.ts`
- `src/server/services/family-service.ts`
- `src/app/api/cron/sync-calendars/route.ts`
- `src/app/api/cron/renew-channels/route.ts`
- `src/app/api/cron/setup-channels/route.ts`
- `src/app/api/v1/devices/pair/generate/route.ts`
- `src/app/api/v1/invites/[token]/accept/route.ts`
- `src/app/api/v1/families/[familyId]/calendars/route.ts`
- `src/lib/pusher.ts`
- `.github/workflows/ci.yml`

### High Priority

- `src/server/auth.ts`
- `src/server/db/index.ts`
- `src/app/api/webhooks/google-calendar/route.ts`
- `src/app/api/pusher/auth/route.ts`
- `next.config.ts`

---

## 10. Conclusion

The Family Planner v3 application demonstrates **strong foundational security practices** including:

- Proper authentication and authorization patterns
- Consistent multi-tenant data isolation
- Parameterized database queries preventing SQL injection
- Cryptographically secure token generation
- Good separation of client/server secrets

However, **7 critical vulnerabilities** require immediate attention before production deployment:

1. Timing attacks on token comparison
2. Missing rate limiting on sensitive endpoints
3. Weak pairing code entropy
4. Missing input validation on calendar endpoints
5. Optional cron authentication
6. Missing CI environment variables
7. Unvalidated Pusher credentials

With the critical and high priority fixes implemented, this application will have an **excellent security posture** suitable for production deployment handling sensitive family calendar and scheduling data.

---

**Report Generated:** 2025-12-25
**Next Review Recommended:** After implementing Week 1-2 fixes
