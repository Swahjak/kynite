// SECURITY: This endpoint only works in E2E test environment
// Multiple guards prevent production usage

import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, sessions } from "@/server/schema";
import { randomUUID, createHmac } from "crypto";

// Guard: Only available in test environment
const isTestEnv =
  process.env.E2E_TEST === "true" &&
  process.env.NODE_ENV !== "production" &&
  process.env.VERCEL_ENV !== "production" &&
  !process.env.BETTER_AUTH_URL?.includes("vercel.app") &&
  !process.env.BETTER_AUTH_URL?.includes("https://");

/**
 * Sign a cookie value using HMAC-SHA256 (matching better-call's signing method)
 * Format: value.base64(signature)
 */
function signCookie(value: string, secret: string): string {
  // Use standard base64 encoding (not base64url) to match better-call
  const signature = createHmac("sha256", secret).update(value).digest("base64");
  return `${value}.${signature}`;
}

export async function POST(request: Request) {
  // SECURITY: Block in production
  if (!isTestEnv) {
    return NextResponse.json(
      { error: "This endpoint is only available in E2E test mode" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "name and email are required" },
        { status: 400 }
      );
    }

    const userId = randomUUID();
    const sessionId = randomUUID();
    const sessionToken = randomUUID();

    // Create user
    await db.insert(users).values({
      id: userId,
      name,
      email,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create session
    await db.insert(sessions).values({
      id: sessionId,
      userId,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      ipAddress: "127.0.0.1",
      userAgent: "E2E Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Sign the session token like better-auth does
    const secret = process.env.BETTER_AUTH_SECRET!;
    const signedToken = signCookie(sessionToken, secret);

    // Create response with signed cookie
    const response = NextResponse.json({
      user: { id: userId, name, email },
      sessionId,
    });

    response.cookies.set("better-auth.session_token", signedToken, {
      httpOnly: true,
      secure: false, // HTTP in test
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Test session creation error:", errorMessage, error);
    return NextResponse.json(
      { error: `Failed to create test session: ${errorMessage}` },
      { status: 500 }
    );
  }
}
