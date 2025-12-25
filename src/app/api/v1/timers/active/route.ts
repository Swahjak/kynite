import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import {
  getActiveTimersForFamily,
  startTimerFromTemplate,
  startOneOffTimer,
} from "@/server/services/active-timer-service";
import {
  startTimerFromTemplateSchema,
  startOneOffTimerSchema,
} from "@/lib/validations/timer";
import { Errors } from "@/lib/errors";

// GET /api/v1/timers/active
export async function GET() {
  try {
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

    const rawTimers = await getActiveTimersForFamily(members[0].familyId);
    const now = new Date();

    // Calculate actual remaining time based on elapsed time since last sync
    const timers = rawTimers.map((timer) => {
      let remainingSeconds = timer.remainingSeconds;

      if (timer.status === "running" && timer.lastSyncAt) {
        const elapsedSinceSync = Math.floor(
          (now.getTime() - timer.lastSyncAt.getTime()) / 1000
        );
        remainingSeconds = Math.max(
          0,
          timer.remainingSeconds - elapsedSinceSync
        );
      }

      return { ...timer, remainingSeconds };
    });

    return NextResponse.json({ success: true, data: { timers } });
  } catch (error) {
    console.error("Error fetching active timers:", error);
    return Errors.internal(error);
  }
}

// POST /api/v1/timers/active
export async function POST(request: Request) {
  try {
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

    const body = await request.json();
    const familyId = members[0].familyId;

    // Try template-based first
    const templateParsed = startTimerFromTemplateSchema.safeParse(body);
    if (templateParsed.success) {
      const timer = await startTimerFromTemplate(familyId, templateParsed.data);
      return NextResponse.json(
        { success: true, data: { timer } },
        { status: 201 }
      );
    }

    // Try one-off timer
    const oneOffParsed = startOneOffTimerSchema.safeParse(body);
    if (oneOffParsed.success) {
      const timer = await startOneOffTimer(familyId, oneOffParsed.data);
      return NextResponse.json(
        { success: true, data: { timer } },
        { status: 201 }
      );
    }

    return Errors.validation({
      template: templateParsed.error,
      oneOff: oneOffParsed.error,
    });
  } catch (error) {
    console.error("Error starting timer:", error);
    return Errors.internal(error);
  }
}
