/**
 * Structured error codes for API responses.
 * See ADR: docs/adr/20251225-structured-error-codes.md
 */
export enum ErrorCode {
  // Authentication
  AUTH_REQUIRED = "AUTH_REQUIRED",
  AUTH_INVALID = "AUTH_INVALID",
  AUTH_EXPIRED = "AUTH_EXPIRED",

  // Authorization
  FORBIDDEN = "FORBIDDEN",
  NOT_FAMILY_MEMBER = "NOT_FAMILY_MEMBER",
  MANAGER_REQUIRED = "MANAGER_REQUIRED",

  // Resources
  NOT_FOUND = "NOT_FOUND",
  ALREADY_EXISTS = "ALREADY_EXISTS",

  // Validation
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",

  // Rate Limiting
  RATE_LIMITED = "RATE_LIMITED",
  TOO_MANY_ATTEMPTS = "TOO_MANY_ATTEMPTS",

  // External Services
  GOOGLE_ERROR = "GOOGLE_ERROR",
  PUSHER_ERROR = "PUSHER_ERROR",

  // Generic
  INTERNAL_ERROR = "INTERNAL_ERROR",
  BAD_REQUEST = "BAD_REQUEST",
}

/**
 * Human-readable messages for error codes.
 * Production uses generic messages; development can show details.
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCode.AUTH_REQUIRED]: "Authentication required",
  [ErrorCode.AUTH_INVALID]: "Invalid credentials",
  [ErrorCode.AUTH_EXPIRED]: "Session expired",
  [ErrorCode.FORBIDDEN]: "Access denied",
  [ErrorCode.NOT_FAMILY_MEMBER]: "Not a member of this family",
  [ErrorCode.MANAGER_REQUIRED]: "Manager role required",
  [ErrorCode.NOT_FOUND]: "Resource not found",
  [ErrorCode.ALREADY_EXISTS]: "Resource already exists",
  [ErrorCode.VALIDATION_ERROR]: "Invalid input",
  [ErrorCode.INVALID_INPUT]: "Invalid request data",
  [ErrorCode.RATE_LIMITED]: "Too many requests",
  [ErrorCode.TOO_MANY_ATTEMPTS]: "Maximum attempts exceeded",
  [ErrorCode.GOOGLE_ERROR]: "Google service error",
  [ErrorCode.PUSHER_ERROR]: "Real-time service error",
  [ErrorCode.INTERNAL_ERROR]: "Something went wrong",
  [ErrorCode.BAD_REQUEST]: "Bad request",
};

/**
 * HTTP status codes for each error type.
 */
export const ErrorStatusCodes: Record<ErrorCode, number> = {
  [ErrorCode.AUTH_REQUIRED]: 401,
  [ErrorCode.AUTH_INVALID]: 401,
  [ErrorCode.AUTH_EXPIRED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FAMILY_MEMBER]: 403,
  [ErrorCode.MANAGER_REQUIRED]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.TOO_MANY_ATTEMPTS]: 429,
  [ErrorCode.GOOGLE_ERROR]: 502,
  [ErrorCode.PUSHER_ERROR]: 502,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.BAD_REQUEST]: 400,
};
