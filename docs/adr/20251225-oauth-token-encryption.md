# ADR: OAuth Token Encryption at Rest

**Date:** 2025-12-25
**Status:** Accepted (Updated)
**Context:** Security Audit - High Priority (Database Security 3.1)

## Decision

Use **better-auth's built-in `encryptOAuthTokens`** option instead of custom encryption.

## Context

Google OAuth tokens (access and refresh tokens) are currently stored as plain text in the database. If the database is compromised, attackers would gain access to all users' Google Calendar data.

Fields affected in `accounts` table:

- `accessToken`
- `refreshToken`
- `idToken`

Options considered:

1. **@47ng/cloak** - Custom field-level encryption (original decision)
2. **better-auth built-in** - Use `encryptOAuthTokens: true` option
3. **Accept the risk** - Tokens are scoped, DB compromise is bigger issue

## Rationale

better-auth's built-in encryption is preferred because:

- **No new dependency** - Uses existing better-auth library
- **No new secret** - Uses existing `BETTER_AUTH_SECRET` for encryption
- **Battle-tested** - Part of the auth library we already trust
- **Zero code** - Single config option vs custom utilities
- **Automatic** - Handles encrypt on write, decrypt on read transparently
- **Migration handled** - New tokens encrypted, old tokens still readable

From [better-auth docs](https://www.better-auth.com/docs/reference/options):

> `encryptOAuthTokens`: Encrypt OAuth tokens before storing them in the database.

## Implementation

### Single-line change in auth.ts:

```typescript
account: {
  accountLinking: {
    enabled: true,
    allowDifferentEmails: true,
  },
  encryptOAuthTokens: true, // NEW
},
```

### Migration of existing tokens

Existing plain-text tokens remain readable. New tokens will be encrypted.
Users who re-authenticate will have encrypted tokens.
No migration script needed - graceful coexistence.

## Consequences

### Positive

- Tokens protected even if database is compromised
- Zero new dependencies
- No new secrets to manage
- Single line of code change
- Automatic encrypt/decrypt handling

### Negative

- Tied to better-auth's encryption implementation
- If `BETTER_AUTH_SECRET` is rotated, users must re-link Google accounts

### Mitigations

- Document that `BETTER_AUTH_SECRET` should never change after deployment
- Better-auth handles decryption failure gracefully

## Supersedes

This decision supersedes the original plan to use `@47ng/cloak` with a separate `TOKEN_ENCRYPTION_KEY`.

## Related

- Security Audit: Database Security 3.1
- better-auth options: https://www.better-auth.com/docs/reference/options
- Auth config: `src/server/auth.ts`
