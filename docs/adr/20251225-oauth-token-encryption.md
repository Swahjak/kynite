# ADR: OAuth Token Encryption at Rest

**Date:** 2025-12-25
**Status:** Accepted
**Context:** Security Audit - High Priority (Database Security 3.1)

## Decision

Implement **field-level encryption** for Google OAuth tokens using `@47ng/cloak`.

## Context

Google OAuth tokens (access and refresh tokens) are currently stored as plain text in the database. If the database is compromised, attackers would gain access to all users' Google Calendar data.

Fields affected in `googleAccounts` table:

- `accessToken`
- `refreshToken`

Options considered:

1. **Field-level encryption** - Encrypt tokens at application layer before storage
2. **Accept the risk** - Tokens are scoped to read-only, DB compromise is bigger issue
3. **Defer** - Address before scaling, not blocking for launch

## Rationale

- Tokens grant access to users' Google Calendar data (sensitive)
- Refresh tokens provide long-lived access until revoked
- Field-level encryption is straightforward with modern libraries
- Defense in depth: even with DB access, tokens remain protected
- One-time implementation cost, ongoing protection

## Implementation

### 1. Add dependency

```bash
pnpm add @47ng/cloak
```

### 2. Add environment variable

```
TOKEN_ENCRYPTION_KEY=<generate with: pnpm dlx @47ng/cloak generate>
```

### 3. Create encryption utility

```typescript
// src/lib/encryption.ts
import { encrypt, decrypt } from "@47ng/cloak";

const key = process.env.TOKEN_ENCRYPTION_KEY;

export function encryptToken(token: string): string {
  if (!key) throw new Error("TOKEN_ENCRYPTION_KEY required");
  return encrypt(token, key);
}

export function decryptToken(encrypted: string): string {
  if (!key) throw new Error("TOKEN_ENCRYPTION_KEY required");
  return decrypt(encrypted, key);
}
```

### 4. Wrap token operations

- Encrypt on write (when storing tokens from OAuth callback)
- Decrypt on read (when using tokens for API calls)
- Handle decryption failure gracefully (prompt re-auth)

### 5. Migration

- Create migration script to encrypt existing plain-text tokens
- Run once in production after deploying encryption code

## Consequences

### Positive

- Tokens protected even if database is compromised
- Minimal performance impact
- Simple implementation with proven library

### Negative

- If encryption key is lost, all users must re-authenticate with Google
- Slightly more complex token handling code
- Need to manage additional secret (TOKEN_ENCRYPTION_KEY)

### Mitigations

- Document key backup procedure
- Graceful fallback: if decryption fails, prompt user to re-link Google account
- Add key to all environment configurations (dev, CI, production)

## Related

- Security Audit: Database Security 3.1
- Schema: `src/server/schema.ts` (googleAccounts table)
- Google OAuth service files
