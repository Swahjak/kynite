# ADR: Google-Only Authentication

**Date:** 2025-12-25
**Status:** Accepted
**Context:** Security Audit - High Priority (Authentication 1.1)

## Decision

Support **only Google OAuth** for authentication. No fallback authentication method.

## Context

The security audit flagged the lack of a fallback authentication method as a risk - if Google OAuth is unavailable, users cannot authenticate.

Options considered:

1. **Add email/password** - Full password authentication with policies, reset flows
2. **Accept single provider** - Rely on Google OAuth only
3. **Add magic links** - Email-based passwordless auth as fallback

## Rationale

We knowingly choose to support only Google SSO because:

1. **Tight Google integration** - The app's core value is Google Calendar integration. If Google auth is down, calendar sync is also down. A fallback auth method doesn't help.

2. **Target audience** - Family users who already use Google Calendar. Requiring a Google account is a feature, not a limitation.

3. **Reduced complexity** - No password policies, no password reset flows, no credential storage, no brute force protection for passwords.

4. **Security benefit** - Google handles MFA, suspicious login detection, and account recovery. We inherit their security investment.

5. **Reliability** - Google OAuth has 99.9%+ uptime. The risk of extended outage is minimal.

## Consequences

### Positive

- Simpler codebase
- No password-related security concerns
- Users benefit from Google's security features
- Consistent with app's Google-centric design

### Negative

- Users must have a Google account
- If Google OAuth has issues, app is inaccessible
- Cannot serve users in regions where Google is blocked

### Accepted Risks

- Temporary inaccessibility during rare Google outages
- Dependency on Google's OAuth service

## Future Considerations

If requirements change (e.g., enterprise customers without Google), revisit this decision. Magic links would be the recommended fallback approach.

## Related

- Security Audit: Authentication 1.1
- Auth configuration: `src/server/auth.ts`
