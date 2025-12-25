# ADR: Structured Error Codes

**Date:** 2025-12-25
**Status:** Accepted
**Context:** Security Audit - Medium Priority (API Security)

## Decision

Use **structured error codes** instead of raw error messages in API responses.

## Context

The security audit flagged that error messages may leak internal implementation details (stack traces, database errors, etc.). Need to balance security with debuggability.

Options considered:

1. **Generic errors** - Always return "Something went wrong"
2. **Structured error codes** - Return typed codes that client can handle

## Rationale

Structured error codes provide:

- Security: No internal details exposed
- UX: Client can show appropriate messages per error type
- Debugging: Error codes are searchable in logs
- i18n: Client can translate codes to localized messages

## Implementation

### Error Response Format

```typescript
interface ApiError {
  code: string; // e.g., "AUTH_REQUIRED", "FAMILY_NOT_FOUND"
  message: string; // Human-readable (generic in production)
  details?: unknown; // Only in development
}
```

### Error Codes by Domain

```typescript
// Authentication
AUTH_REQUIRED = "AUTH_REQUIRED";
AUTH_INVALID = "AUTH_INVALID";
AUTH_EXPIRED = "AUTH_EXPIRED";

// Authorization
FORBIDDEN = "FORBIDDEN";
NOT_FAMILY_MEMBER = "NOT_FAMILY_MEMBER";
MANAGER_REQUIRED = "MANAGER_REQUIRED";

// Resources
NOT_FOUND = "NOT_FOUND";
ALREADY_EXISTS = "ALREADY_EXISTS";

// Validation
VALIDATION_ERROR = "VALIDATION_ERROR";
INVALID_INPUT = "INVALID_INPUT";

// Rate Limiting
RATE_LIMITED = "RATE_LIMITED";
TOO_MANY_ATTEMPTS = "TOO_MANY_ATTEMPTS";

// External Services
GOOGLE_ERROR = "GOOGLE_ERROR";
PUSHER_ERROR = "PUSHER_ERROR";

// Generic
INTERNAL_ERROR = "INTERNAL_ERROR";
```

### Response Examples

**Production:**

```json
{
  "code": "NOT_FAMILY_MEMBER",
  "message": "Access denied"
}
```

**Development:**

```json
{
  "code": "NOT_FAMILY_MEMBER",
  "message": "User abc123 is not a member of family xyz789",
  "details": { "userId": "abc123", "familyId": "xyz789" }
}
```

### Logging

- Always log full error details server-side
- Include request ID for correlation
- Error codes make log searching easier

## Consequences

### Positive

- No information leakage in production
- Better client-side error handling
- Easier debugging via error codes
- Supports internationalization

### Negative

- Need to define and maintain error code catalog
- Refactor existing error responses
- Client needs error code handling logic

## Related

- Security Audit: API Security (error message leakage)
- All API routes in `src/app/api/`
