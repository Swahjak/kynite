import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const reqHeaders = await headers();
  const cookieHeader = reqHeaders.get("cookie");

  // Test 1: Check if cookies are present
  const hasCookie = !!cookieHeader;
  const hasSessionToken =
    cookieHeader?.includes("better-auth.session_token") ||
    cookieHeader?.includes("__Secure-better-auth.session_token");

  // Test 2: Try to get session using auth.api.getSession (same as getSession() helper)
  let session = null;
  let error = null;
  try {
    session = await auth.api.getSession({
      headers: reqHeaders,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    hasCookie,
    hasSessionToken,
    cookiePreview: cookieHeader?.substring(0, 100) + "...",
    session: session
      ? {
          hasUser: !!session.user,
          userId: session.user?.id,
          email: session.user?.email,
          hasFamilyId: !!session.session?.familyId,
        }
      : null,
    error,
  });
}
