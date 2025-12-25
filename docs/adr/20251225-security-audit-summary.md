# Security Audit Response Summary

**Date:** 2025-12-25
**Audit Reference:** SECURITY_AUDIT.md

## Decisions Made (ADRs)

| #   | Decision                                             | ADR File                             |
| --- | ---------------------------------------------------- | ------------------------------------ |
| 1   | Use Vercel WAF for rate limiting                     | `20251225-rate-limiting.md`          |
| 2   | Keep 6-digit pairing codes + per-code attempt limits | `20251225-rate-limiting.md`          |
| 3   | Both Vercel Cron + CRON_SECRET for cron auth         | `20251225-cron-authentication.md`    |
| 4   | Field-level encryption for OAuth tokens              | `20251225-oauth-token-encryption.md` |
| 5   | Google-only authentication (no fallback)             | `20251225-google-only-auth.md`       |
| 6   | Token-only webhook auth (no IP allowlist)            | `20251225-webhook-token-auth.md`     |
| 7   | Structured error codes in API responses              | `20251225-structured-error-codes.md` |
| 8   | Rely on Vercel's request size limits                 | `20251225-request-size-limits.md`    |

## Items Not Requiring Changes

| Item                         | Reason                                                 |
| ---------------------------- | ------------------------------------------------------ |
| Device session 90-day expiry | Acceptable for wall-mounted displays                   |
| Account lockout policy       | N/A - Google handles OAuth, pairing has attempt limits |

## Implementation Tasks

### Critical Priority

- [ ] Timing-safe token comparison (4 files)
- [ ] Zod validation on calendar endpoints
- [ ] Make CRON_SECRET required in production
- [ ] Add pairing code attempt limiting (DB column + logic)
- [ ] CI environment variables in workflow
- [ ] Pusher credential validation at startup

### High Priority

- [ ] OAuth token encryption with @47ng/cloak
- [ ] Cookie security flags (httpOnly, secure, sameSite)
- [ ] Webhook 401 response for invalid tokens
- [ ] SSL enforcement for database connection

### Medium Priority

- [ ] CSP headers in next.config.ts
- [ ] Origin header validation (CSRF protection)
- [ ] Structured error codes across all API routes
- [ ] Content-Type validation in middleware

### Low Priority / Hardening

- [ ] Security event logging
- [ ] Remove or protect test session endpoint in production

## Files Requiring Changes

### Critical

- `src/server/services/google-channel-service.ts` - timing-safe comparison
- `src/server/services/device-service.ts` - timing-safe + attempt limiting
- `src/server/services/family-service.ts` - timing-safe comparison
- `src/app/api/cron/*/route.ts` - require CRON_SECRET
- `src/app/api/v1/families/[familyId]/calendars/route.ts` - Zod validation
- `src/lib/pusher.ts` - credential validation
- `.github/workflows/ci.yml` - environment variables

### High

- `src/server/auth.ts` - cookie security flags
- `src/server/db/index.ts` - SSL configuration
- `src/server/schema.ts` - token encryption fields
- `src/app/api/webhooks/google-calendar/route.ts` - 401 response

### Medium

- `next.config.ts` - CSP headers
- `src/middleware.ts` - Origin validation, Content-Type check
- All API routes - structured error codes

## External Configuration Required

### Vercel Dashboard

- [ ] Configure WAF rate limiting rules
- [ ] Add CRON_SECRET to environment variables
- [ ] Add TOKEN_ENCRYPTION_KEY to environment variables

### Development

- [ ] Generate TOKEN_ENCRYPTION_KEY: `pnpm dlx @47ng/cloak generate`
- [ ] Add to `.env.local` and `.env.example`
