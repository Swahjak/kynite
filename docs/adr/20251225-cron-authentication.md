# ADR: Cron Job Authentication

**Date:** 2025-12-25
**Status:** Accepted
**Context:** Security Audit - Critical Issue #5

## Decision

Use **both** Vercel Cron protection and application-level `CRON_SECRET` validation.

## Context

The security audit identified that cron endpoints are unprotected if `CRON_SECRET` is not set. Current cron endpoints:

- `/api/cron/sync-calendars` - Syncs Google Calendar events
- `/api/cron/renew-channels` - Renews push notification channels
- `/api/cron/setup-channels` - Sets up new channels

Options considered:

1. **Make CRON_SECRET required** - Throw error at startup if missing in production
2. **Use Vercel Cron protection** - Vercel automatically protects cron routes
3. **Both** - Defense in depth

## Rationale

Defense in depth is the right approach for scheduled jobs that modify data:

- Vercel Cron protection: First line of defense at infrastructure level
- CRON_SECRET validation: Application-level verification, works if we ever migrate away from Vercel

## Implementation

1. **Vercel Configuration** (`vercel.json`):

   ```json
   {
     "crons": [
       { "path": "/api/cron/sync-calendars", "schedule": "*/15 * * * *" },
       { "path": "/api/cron/renew-channels", "schedule": "0 * * * *" },
       { "path": "/api/cron/setup-channels", "schedule": "*/5 * * * *" }
     ]
   }
   ```

2. **Application-level validation**:
   - Make `CRON_SECRET` required in production (throw at startup if missing)
   - Validate `Authorization: Bearer <CRON_SECRET>` header on all cron routes
   - Return 401 for missing/invalid secret

3. **Environment validation** (in startup or middleware):
   ```typescript
   if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET) {
     throw new Error("CRON_SECRET is required in production");
   }
   ```

## Consequences

### Positive

- Two layers of protection
- Portable if we migrate from Vercel
- Fail-fast in production if misconfigured

### Negative

- Slightly more configuration required
- Need to ensure CRON_SECRET is set in Vercel environment variables

## Related

- Security Audit: Critical Issue #5
- Vercel Cron documentation: https://vercel.com/docs/cron-jobs
