# ADR: Request Size Limits

**Date:** 2025-12-25
**Status:** Accepted
**Context:** Security Audit - Medium Priority (API Security)

## Decision

Rely on **Vercel's default request size limits** (4.5MB). No application-level size limiting.

## Context

The security audit flagged missing request body size limits as a potential DoS vector. Large payloads could cause memory exhaustion.

Options considered:

1. **Next.js config** - Per-route `bodyParser.sizeLimit` configuration
2. **Middleware** - Global size check before route handlers
3. **Vercel limits** - Platform-enforced 4.5MB limit

## Rationale

For this application, Vercel's defaults are sufficient because:

1. **No large uploads** - Family Planner doesn't handle file uploads or large data submissions
2. **Typical payloads** - Calendar events, family settings, device pairing - all small JSON payloads (< 10KB typical)
3. **Platform protection** - Vercel enforces limits at edge before hitting application
4. **Simplicity** - No additional code to maintain

Expected payload sizes:

- Create event: ~1KB
- Update settings: ~500B
- Device pairing: ~200B
- Largest (calendar sync response): ~50KB

## Consequences

### Positive

- No additional code complexity
- Platform handles enforcement at edge
- Consistent with Vercel's security model

### Negative

- Less fine-grained control per route
- Tied to Vercel's limits (acceptable given deployment target)
- If adding file uploads later, will need explicit limits

### Future Considerations

- If file upload features are added, implement explicit limits for those routes
- If migrating from Vercel, add middleware-based size limiting

## Related

- Security Audit: API Security (request size limits)
- Vercel limits: https://vercel.com/docs/functions/limitations
