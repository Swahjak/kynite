import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import {
  getTimerById,
  pauseTimer,
  resumeTimer,
  extendTimer,
  cancelTimer,
  syncTimerState,
} from "@/server/services/active-timer-service";
import { syncTimerSchema, extendTimerSchema } from "@/lib/validations/timer";

type Params = Promise<{ id: string }>;

// GET /api/v1/timers/active/[id]
export async function GET(request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
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

    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (members.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "No family found" },
        },
        { status: 404 }
      );
    }

    const timer = await getTimerById(id, members[0].familyId);

    if (!timer) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Timer not found" },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { timer } });
  } catch (error) {
    console.error("Error fetching timer:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch timer" },
      },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/timers/active/[id]
// Supports: pause, resume, extend, sync
export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
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

    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (members.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "No family found" },
        },
        { status: 404 }
      );
    }

    const familyId = members[0].familyId;
    const body = await request.json();
    const { action, deviceId, ...data } = body;

    let timer;

    switch (action) {
      case "pause":
        timer = await pauseTimer(id, familyId, deviceId);
        break;
      case "resume":
        timer = await resumeTimer(id, familyId, deviceId);
        break;
      case "extend": {
        const extendParsed = extendTimerSchema.safeParse(data);
        if (!extendParsed.success) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "VALIDATION_ERROR",
                message: "Invalid extend data",
              },
            },
            { status: 400 }
          );
        }
        timer = await extendTimer(id, familyId, extendParsed.data);
        break;
      }
      case "sync": {
        const syncParsed = syncTimerSchema.safeParse({ ...data, deviceId });
        if (!syncParsed.success) {
          return NextResponse.json(
            {
              success: false,
              error: { code: "VALIDATION_ERROR", message: "Invalid sync data" },
            },
            { status: 400 }
          );
        }
        timer = await syncTimerState(id, familyId, syncParsed.data);
        break;
      }
      default:
        return NextResponse.json(
          {
            success: false,
            error: { code: "BAD_REQUEST", message: "Unknown action" },
          },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, data: { timer } });
  } catch (error) {
    console.error("Error updating timer:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update timer";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/timers/active/[id]
export async function DELETE(request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
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

    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (members.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "No family found" },
        },
        { status: 404 }
      );
    }

    await cancelTimer(id, members[0].familyId);

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    console.error("Error cancelling timer:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to cancel timer" },
      },
      { status: 500 }
    );
  }
}
