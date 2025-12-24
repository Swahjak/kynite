import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import { confirmTimer } from "@/server/services/active-timer-service";
import { confirmTimerSchema } from "@/lib/validations/timer";

type Params = Promise<{ id: string }>;

// POST /api/v1/timers/active/[id]/confirm
export async function POST(request: Request, { params }: { params: Params }) {
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

    const body = await request.json();
    const parsed = confirmTimerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.message },
        },
        { status: 400 }
      );
    }

    const result = await confirmTimer(id, members[0].familyId, parsed.data);

    return NextResponse.json({
      success: true,
      data: { timer: result.timer, starsAwarded: result.starsAwarded },
    });
  } catch (error) {
    console.error("Error confirming timer:", error);
    const message =
      error instanceof Error ? error.message : "Failed to confirm timer";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
