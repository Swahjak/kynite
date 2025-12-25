import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import { createPairingCode } from "@/server/services/device-service";
import { generatePairingCodeSchema } from "@/lib/validations/device";
import { Errors } from "@/lib/errors";

// POST /api/v1/devices/pair/generate
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Errors.unauthorized();
    }

    // Get user's family membership
    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (!member) {
      return Errors.notFound("family");
    }

    // Only managers can add devices
    if (member.role !== "manager") {
      return Errors.managerRequired();
    }

    const body = await request.json();
    const parsed = generatePairingCodeSchema.safeParse(body);

    if (!parsed.success) {
      return Errors.validation(parsed.error);
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
    return Errors.internal(error);
  }
}
