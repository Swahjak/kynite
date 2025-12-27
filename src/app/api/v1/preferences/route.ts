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
      .select({
        use24HourFormat: users.use24HourFormat,
        locale: users.locale,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: {
        use24HourFormat: user?.use24HourFormat ?? true,
        locale: user?.locale ?? null,
      },
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
    const { use24HourFormat, locale } = body;

    // Build update object with only provided fields
    const updateData: {
      use24HourFormat?: boolean;
      locale?: string | null;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (typeof use24HourFormat === "boolean") {
      updateData.use24HourFormat = use24HourFormat;
    }

    if (locale !== undefined) {
      // Validate locale is one of the supported values or null
      if (locale !== null && locale !== "nl" && locale !== "en") {
        return NextResponse.json(
          { success: false, error: "locale must be 'nl', 'en', or null" },
          { status: 400 }
        );
      }
      updateData.locale = locale;
    }

    await db.update(users).set(updateData).where(eq(users.id, session.user.id));

    // Fetch updated preferences
    const [user] = await db
      .select({
        use24HourFormat: users.use24HourFormat,
        locale: users.locale,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: {
        use24HourFormat: user?.use24HourFormat ?? true,
        locale: user?.locale ?? null,
      },
    });
  } catch (error) {
    console.error("Error updating preferences:", error);
    return Errors.internal(error);
  }
}
