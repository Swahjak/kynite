import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import { getDevicesForFamily } from "@/server/services/device-service";
import { Errors } from "@/lib/errors";

// GET /api/v1/devices
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Errors.unauthorized();
    }

    // Devices can't manage other devices
    if ((session.user as { type?: string }).type === "device") {
      return Errors.forbidden({ reason: "Devices cannot manage devices" });
    }

    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (!member) {
      return Errors.notFound("family");
    }

    // Only managers can view devices
    if (member.role !== "manager") {
      return Errors.managerRequired();
    }

    const devices = await getDevicesForFamily(member.familyId);

    return NextResponse.json({ success: true, data: { devices } });
  } catch (error) {
    console.error("Error fetching devices:", error);
    return Errors.internal(error);
  }
}
