import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { sessions } from "@/server/schema";
import { createId } from "@paralleldrive/cuid2";
import {
  consumePairingCode,
  createDeviceUser,
} from "@/server/services/device-service";
import { completePairingSchema } from "@/lib/validations/device";

const DEVICE_SESSION_EXPIRY_DAYS = 90;

// POST /api/v1/devices/pair/complete
export async function POST(request: Request) {
  try {
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

    // Set the session cookie
    const cookieStore = await cookies();
    cookieStore.set("better-auth.session_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    return NextResponse.json({
      success: true,
      data: {
        deviceName: pairingCode.deviceName,
        message: "Device paired successfully",
      },
    });
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
