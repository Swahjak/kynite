import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import { createPairingCode } from "@/server/services/device-service";
import { generatePairingCodeSchema } from "@/lib/validations/device";

// POST /api/v1/devices/pair/generate
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    // Get user's family membership
    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (!member) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "No family found" },
        },
        { status: 404 }
      );
    }

    // Only managers can add devices
    if (member.role !== "manager") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can add devices",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = generatePairingCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.message },
        },
        { status: 400 }
      );
    }

    const { code, expiresAt } = await createPairingCode(
      member.familyId,
      session.user.id,
      parsed.data.deviceName
    );

    return NextResponse.json({
      success: true,
      data: { code, expiresAt: expiresAt.toISOString() },
    });
  } catch (error) {
    console.error("Error generating pairing code:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to generate code" },
      },
      { status: 500 }
    );
  }
}
