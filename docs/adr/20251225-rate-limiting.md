# ADR: Rate Limiting Strategy

**Date:** 2025-12-25
**Status:** Accepted
**Context:** Security Audit - Critical Issue #2

## Decision

Use **Vercel WAF (Web Application Firewall)** for rate limiting instead of application-level rate limiting.

## Context

The security audit identified missing rate limiting on critical endpoints as a critical vulnerability:

- Device pairing code generation (`/api/v1/devices/pair/generate`)
- Invite acceptance (`/api/v1/invites/[token]/accept`)
- Google Calendar webhooks (`/api/webhooks/google-calendar`)

Options considered:

1. **Existing in-memory utility** (`src/lib/rate-limit.ts`) - Simple but doesn't persist across serverless instances
2. **Upstash Rate Limit** - Redis-based, works in serverless, requires additional service
3. **Vercel WAF** - Built into Vercel Pro plan, no code changes required

## Rationale

- Already on Vercel Pro plan, so no additional cost
- No code changes required - configuration-based
- Handles rate limiting at the edge before hitting application code
- Consistent protection across all endpoints
- No additional operational burden (no Redis to manage)

## Consequences

### Positive

- Zero application code changes for basic rate limiting
- Edge-level protection reduces load on application
- Centralized configuration in Vercel dashboard

### Negative

- Less fine-grained control than application-level rate limiting
- Tied to Vercel platform
- May still need application-level rate limiting for specific business logic (e.g., pairing code attempts per device)

## Implementation

1. Configure Vercel WAF rules in project settings
2. Set appropriate limits for:
   - Authentication endpoints: 10 requests/minute per IP
   - Pairing code generation: 5 requests/minute per IP
   - Webhook endpoints: 100 requests/minute per IP (Google sends bursts)
3. Monitor and adjust based on legitimate usage patterns

## Additional Decision: Pairing Code Attempt Limiting

**Context:** Security Audit - Critical Issue #3 (Weak Pairing Code Entropy)

Keep 6-digit pairing codes for UX reasons (easy to type on wall displays), but add application-level attempt tracking as defense in depth:

- Add `attempts` column to pairing code table
- Invalidate code after 5 failed attempts
- Combined with WAF rate limiting, brute force becomes impractical

**Rationale:**

- 6 digits = 1M combinations
- WAF limits to ~5 requests/minute per IP
- App invalidates after 5 failed attempts per code
- 5-minute code expiry limits attack window
- UX preserved for legitimate users

## Related

- Security Audit: Critical Issue #2, #3
- Existing rate-limit utility: `src/lib/rate-limit.ts` (may be removed or kept for specific use cases)
