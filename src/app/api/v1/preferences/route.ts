import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { users } from "@/server/schema";
import { Errors } from "@/lib/errors";

// GET /api/v1/preferences
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Errors.unauthorized();
    }

    const [user] = await db
      .select({ use24HourFormat: users.use24HourFormat })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: { use24HourFormat: user?.use24HourFormat ?? true },
    });
  } catch (error) {
    console.error("Error fetching preferences:", error);
    return Errors.internal(error);
  }
}

// PATCH /api/v1/preferences
export async function PATCH(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Errors.unauthorized();
    }

    const body = await request.json();
    const { use24HourFormat } = body;

    if (typeof use24HourFormat !== "boolean") {
      return NextResponse.json(
        { success: false, error: "use24HourFormat must be a boolean" },
        { status: 400 }
      );
    }

    await db
      .update(users)
      .set({
        use24HourFormat,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({
      success: true,
      data: { use24HourFormat },
    });
  } catch (error) {
    console.error("Error updating preferences:", error);
    return Errors.internal(error);
  }
}
