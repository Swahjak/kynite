import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import {
  updateDeviceName,
  deleteDevice,
  verifyDeviceInFamily,
} from "@/server/services/device-service";
import { updateDeviceSchema } from "@/lib/validations/device";
import { Errors } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/v1/devices/:id
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: deviceId } = await context.params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return Errors.unauthorized();
    }

    if ((session.user as { type?: string }).type === "device") {
      return Errors.forbidden({ reason: "Devices cannot manage devices" });
    }

    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (!member || member.role !== "manager") {
      return Errors.managerRequired();
    }

    // Verify device belongs to this family
    const belongs = await verifyDeviceInFamily(deviceId, member.familyId);
    if (!belongs) {
      return Errors.notFound("device");
    }

    const body = await request.json();
    const parsed = updateDeviceSchema.safeParse(body);

    if (!parsed.success) {
      return Errors.validation(parsed.error);
    }

    await updateDeviceName(deviceId, parsed.data.name);

    return NextResponse.json({
      success: true,
      data: { message: "Device updated" },
    });
  } catch (error) {
    console.error("Error updating device:", error);
    return Errors.internal(error);
  }
}

// DELETE /api/v1/devices/:id
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id: deviceId } = await context.params;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return Errors.unauthorized();
    }

    if ((session.user as { type?: string }).type === "device") {
      return Errors.forbidden({ reason: "Devices cannot manage devices" });
    }

    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (!member || member.role !== "manager") {
      return Errors.managerRequired();
    }

    const belongs = await verifyDeviceInFamily(deviceId, member.familyId);
    if (!belongs) {
      return Errors.notFound("device");
    }

    await deleteDevice(deviceId);

    return NextResponse.json({
      success: true,
      data: { message: "Device removed" },
    });
  } catch (error) {
    console.error("Error deleting device:", error);
    return Errors.internal(error);
  }
}
