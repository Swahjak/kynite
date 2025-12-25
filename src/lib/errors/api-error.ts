// src/lib/errors/api-error.ts
import { NextResponse } from "next/server";
import { ErrorCode, ErrorMessages, ErrorStatusCodes } from "./codes";

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * Create a structured error response.
 * In production, hides details. In development, includes them.
 */
export function createErrorResponse(
  code: ErrorCode,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const isDev = process.env.NODE_ENV === "development";

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message: ErrorMessages[code],
      ...(isDev && details ? { details } : {}),
    },
  };

  return NextResponse.json(response, {
    status: ErrorStatusCodes[code],
  });
}

/**
 * Shorthand error response creators for common cases.
 */
export const Errors = {
  unauthorized: (details?: unknown) =>
    createErrorResponse(ErrorCode.AUTH_REQUIRED, details),

  forbidden: (details?: unknown) =>
    createErrorResponse(ErrorCode.FORBIDDEN, details),

  notFound: (resource?: string) =>
    createErrorResponse(
      ErrorCode.NOT_FOUND,
      resource ? { resource } : undefined
    ),

  validation: (errors: unknown) =>
    createErrorResponse(ErrorCode.VALIDATION_ERROR, errors),

  notFamilyMember: (details?: unknown) =>
    createErrorResponse(ErrorCode.NOT_FAMILY_MEMBER, details),

  managerRequired: (details?: unknown) =>
    createErrorResponse(ErrorCode.MANAGER_REQUIRED, details),

  googleError: (details?: unknown) =>
    createErrorResponse(ErrorCode.GOOGLE_ERROR, details),

  internal: (details?: unknown) =>
    createErrorResponse(ErrorCode.INTERNAL_ERROR, details),

  badRequest: (details?: unknown) =>
    createErrorResponse(ErrorCode.BAD_REQUEST, details),
};
