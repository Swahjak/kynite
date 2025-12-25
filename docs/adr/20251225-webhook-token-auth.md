# ADR: Webhook Authentication - Token Only

**Date:** 2025-12-25
**Status:** Accepted
**Context:** Security Audit - High Priority (Authentication 1.4)

## Decision

Use **token-based verification only** for Google Calendar webhooks. Do not implement IP allowlisting.

## Context

The security audit suggested adding IP allowlisting for Google's webhook servers as an additional security layer. Currently, webhooks are verified by checking the `X-Goog-Resource-Token` header against stored channel tokens.

Options considered:

1. **Add IP allowlist** - Validate requests come from Google's published IP ranges
2. **Token-only** - Continue with cryptographic token verification

## Rationale

Token verification is sufficient because:

1. **Token security** - Tokens are generated with `crypto.randomBytes()`, providing 256 bits of entropy. Guessing is computationally infeasible.

2. **Attack scenario** - An attacker would need both:
   - Knowledge of a valid token (stored server-side only)
   - Ability to spoof Google's IP (if we implemented allowlisting)

   If they have the token, IP validation doesn't help. If they don't have the token, they can't forge requests regardless of IP.

3. **Operational burden** - Google's IP ranges change. Maintaining an allowlist requires:
   - Monitoring Google's IP range publications
   - Updating configuration when ranges change
   - Risk of blocking legitimate webhooks if ranges aren't updated

4. **Rate limiting** - WAF rate limiting already protects against webhook spam attacks.

## Consequences

### Positive

- Simpler implementation
- No maintenance burden for IP range updates
- No risk of blocking legitimate webhooks

### Negative

- One fewer defense layer (defense in depth argument)

### Accepted Risks

- Theoretical risk of token-bearing requests from non-Google IPs (requires token compromise first)

## Related

- Security Audit: Authentication 1.4
- Webhook handler: `src/app/api/webhooks/google-calendar/route.ts`
- Channel service: `src/server/services/google-channel-service.ts`
