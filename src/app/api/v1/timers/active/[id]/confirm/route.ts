import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import { confirmTimer } from "@/server/services/active-timer-service";
import { confirmTimerSchema } from "@/lib/validations/timer";
import { Errors } from "@/lib/errors";

type Params = Promise<{ id: string }>;

// POST /api/v1/timers/active/[id]/confirm
export async function POST(request: Request, { params }: { params: Params }) {
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

    const body = await request.json();
    const parsed = confirmTimerSchema.safeParse(body);

    if (!parsed.success) {
      return Errors.validation(parsed.error);
    }

    const result = await confirmTimer(id, members[0].familyId, parsed.data);

    return NextResponse.json({
      success: true,
      data: { timer: result.timer, starsAwarded: result.starsAwarded },
    });
  } catch (error) {
    console.error("Error confirming timer:", error);
    return Errors.internal(error);
  }
}
