// src/app/api/v1/link-account/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import {
  getUpgradeToken,
  upgradeChildToAccount,
} from "@/server/services/child-service";
import { Errors, ErrorCode, createErrorResponse } from "@/lib/errors";

/**
 * GET /api/v1/link-account?token=xxx
 * Validate an upgrade token (public endpoint, checks expiry and usage)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return Errors.badRequest({ message: "Token is required" });
    }

    const upgradeToken = await getUpgradeToken(token);

    if (!upgradeToken) {
      return NextResponse.json({
        success: true,
        data: {
          valid: false,
          reason: "Token not found, expired, or already used",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        expiresAt: upgradeToken.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error validating upgrade token:", error);
    return Errors.internal(error);
  }
}

/**
 * POST /api/v1/link-account
 * Link a child profile to an authenticated user account
 * Body: { token: string }
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Errors.unauthorized();
    }

    // Get request body
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return Errors.validation({ message: "Token is required" });
    }

    // Validate token exists and is not expired/used
    const upgradeToken = await getUpgradeToken(token);
    if (!upgradeToken) {
      return createErrorResponse(ErrorCode.NOT_FOUND, {
        message: "Invalid, expired, or already used token",
      });
    }

    // Upgrade the child account
    try {
      const updatedUser = await upgradeChildToAccount(
        token,
        session.user.email,
        session.user.name
      );

      return NextResponse.json({
        success: true,
        data: {
          userId: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
        },
      });
    } catch (error) {
      // Handle specific upgrade errors
      if (error instanceof Error) {
        if (error.message === "Email already in use") {
          return createErrorResponse(ErrorCode.ALREADY_EXISTS, {
            message: "This email is already linked to another account",
          });
        }
        if (error.message === "Invalid token") {
          return createErrorResponse(ErrorCode.NOT_FOUND, {
            message: "Invalid token",
          });
        }
        if (error.message === "Token expired") {
          return createErrorResponse(ErrorCode.AUTH_EXPIRED, {
            message: "Token has expired",
          });
        }
        if (error.message === "Token already used") {
          return createErrorResponse(ErrorCode.ALREADY_EXISTS, {
            message: "Token has already been used",
          });
        }
      }
      throw error; // Re-throw unexpected errors
    }
  } catch (error) {
    console.error("Error linking account:", error);
    return Errors.internal(error);
  }
}
