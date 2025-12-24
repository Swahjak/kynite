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

// GET /api/v1/timers/active
export async function GET() {
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

    const timers = await getActiveTimersForFamily(members[0].familyId);

    return NextResponse.json({ success: true, data: { timers } });
  } catch (error) {
    console.error("Error fetching active timers:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch timers" },
      },
      { status: 500 }
    );
  }
}

// POST /api/v1/timers/active
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

    return NextResponse.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid timer data" },
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error starting timer:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to start timer" },
      },
      { status: 500 }
    );
  }
}
