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

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/v1/devices/:id
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: deviceId } = await context.params;
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

    if ((session.user as { type?: string }).type === "device") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Devices cannot manage devices",
          },
        },
        { status: 403 }
      );
    }

    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (!member || member.role !== "manager") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can update devices",
          },
        },
        { status: 403 }
      );
    }

    // Verify device belongs to this family
    const belongs = await verifyDeviceInFamily(deviceId, member.familyId);
    if (!belongs) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Device not found" },
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateDeviceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.message },
        },
        { status: 400 }
      );
    }

    await updateDeviceName(deviceId, parsed.data.name);

    return NextResponse.json({
      success: true,
      data: { message: "Device updated" },
    });
  } catch (error) {
    console.error("Error updating device:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to update device" },
      },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/devices/:id
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id: deviceId } = await context.params;
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

    if ((session.user as { type?: string }).type === "device") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Devices cannot manage devices",
          },
        },
        { status: 403 }
      );
    }

    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (!member || member.role !== "manager") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can remove devices",
          },
        },
        { status: 403 }
      );
    }

    const belongs = await verifyDeviceInFamily(deviceId, member.familyId);
    if (!belongs) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Device not found" },
        },
        { status: 404 }
      );
    }

    await deleteDevice(deviceId);

    return NextResponse.json({
      success: true,
      data: { message: "Device removed" },
    });
  } catch (error) {
    console.error("Error deleting device:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to remove device" },
      },
      { status: 500 }
    );
  }
}
