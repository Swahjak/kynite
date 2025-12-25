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
import { Errors } from "@/lib/errors";

type Params = Promise<{ id: string }>;

// GET /api/v1/timers/active/[id]
export async function GET(request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Errors.unauthorized();
    }

    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (members.length === 0) {
      return Errors.notFound("family");
    }

    const timer = await getTimerById(id, members[0].familyId);

    if (!timer) {
      return Errors.notFound("timer");
    }

    return NextResponse.json({ success: true, data: { timer } });
  } catch (error) {
    console.error("Error fetching timer:", error);
    return Errors.internal(error);
  }
}

// PATCH /api/v1/timers/active/[id]
// Supports: pause, resume, extend, sync
export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Errors.unauthorized();
    }

    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (members.length === 0) {
      return Errors.notFound("family");
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
          return Errors.validation(extendParsed.error);
        }
        timer = await extendTimer(id, familyId, extendParsed.data);
        break;
      }
      case "sync": {
        const syncParsed = syncTimerSchema.safeParse({ ...data, deviceId });
        if (!syncParsed.success) {
          return Errors.validation(syncParsed.error);
        }
        timer = await syncTimerState(id, familyId, syncParsed.data);
        break;
      }
      default:
        return Errors.badRequest({ action });
    }

    return NextResponse.json({ success: true, data: { timer } });
  } catch (error) {
    console.error("Error updating timer:", error);
    return Errors.internal(error);
  }
}

// DELETE /api/v1/timers/active/[id]
export async function DELETE(request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Errors.unauthorized();
    }

    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (members.length === 0) {
      return Errors.notFound("family");
    }

    await cancelTimer(id, members[0].familyId);

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    console.error("Error cancelling timer:", error);
    return Errors.internal(error);
  }
}
