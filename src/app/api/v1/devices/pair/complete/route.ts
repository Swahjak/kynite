import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { sessions } from "@/server/schema";
import { createId } from "@paralleldrive/cuid2";
import {
  consumePairingCode,
  createDeviceUser,
  DEVICE_SESSION_EXPIRY_DAYS,
} from "@/server/services/device-service";
import { completePairingSchema } from "@/lib/validations/device";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { serializeSignedCookie } from "better-call";

// Rate limit: 10 attempts per minute per IP
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

// POST /api/v1/devices/pair/complete
export async function POST(request: Request) {
  try {
    // Apply rate limiting to prevent brute force attacks
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`device-pair:${clientIp}`, {
      limit: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many pairing attempts. Please try again later.",
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
            ),
            "X-RateLimit-Remaining": String(rateLimit.remaining),
          },
        }
      );
    }

    const body = await request.json();
    const parsed = completePairingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid pairing code format",
          },
        },
        { status: 400 }
      );
    }

    // Validate and consume the pairing code
    const pairingCode = await consumePairingCode(parsed.data.code);

    if (!pairingCode) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CODE",
            message: "Invalid or expired pairing code",
          },
        },
        { status: 400 }
      );
    }

    // Create device user and family membership
    const { userId } = await createDeviceUser(
      pairingCode.familyId,
      pairingCode.deviceName
    );

    // Create a long-lived session for the device
    const sessionToken = createId();
    const expiresAt = new Date(
      Date.now() + DEVICE_SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );

    await db.insert(sessions).values({
      id: createId(),
      userId,
      token: sessionToken,
      expiresAt,
    });

    // Set the session cookie with proper signing for better-auth compatibility
    // Using better-call's serializeSignedCookie for compatibility
    const secret = process.env.BETTER_AUTH_SECRET!;
    const cookieHeader = await serializeSignedCookie(
      "better-auth.session_token",
      sessionToken,
      secret,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: expiresAt,
        path: "/",
      }
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          deviceName: pairingCode.deviceName,
          message: "Device paired successfully",
        },
      },
      {
        headers: {
          "Set-Cookie": cookieHeader,
        },
      }
    );
  } catch (error) {
    console.error("Error completing device pairing:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to complete pairing",
        },
      },
      { status: 500 }
    );
  }
}
