import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";

/**
 * Standard unauthorized response
 */
export const UNAUTHORIZED_RESPONSE = NextResponse.json(
  {
    success: false,
    error: { code: "UNAUTHORIZED", message: "Not authenticated" },
  },
  { status: 401 }
);

/**
 * Device forbidden response
 */
export const DEVICE_FORBIDDEN_RESPONSE = NextResponse.json(
  {
    success: false,
    error: {
      code: "FORBIDDEN",
      message: "Devices cannot perform this action",
    },
  },
  { status: 403 }
);

/**
 * Get session and check it's not a device.
 * Returns session if valid non-device user, or null with appropriate response.
 */
export async function getNonDeviceSession(): Promise<{
  session: Awaited<ReturnType<typeof auth.api.getSession>>;
  errorResponse: NextResponse | null;
}> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return { session: null, errorResponse: UNAUTHORIZED_RESPONSE };
  }

  // Check if this is a device session
  const isDevice = (session.user as { type?: string }).type === "device";
  if (isDevice) {
    return { session: null, errorResponse: DEVICE_FORBIDDEN_RESPONSE };
  }

  return { session, errorResponse: null };
}
