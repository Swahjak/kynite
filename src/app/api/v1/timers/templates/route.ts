import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import {
  getTemplatesForFamily,
  createTemplate,
} from "@/server/services/timer-template-service";
import { createTimerTemplateSchema } from "@/lib/validations/timer";

// GET /api/v1/timers/templates
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

    // Get user's family
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

    const templates = await getTemplatesForFamily(members[0].familyId);

    return NextResponse.json({ success: true, data: { templates } });
  } catch (error) {
    console.error("Error fetching timer templates:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch templates" },
      },
      { status: 500 }
    );
  }
}

// POST /api/v1/timers/templates
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
    const parsed = createTimerTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.message },
        },
        { status: 400 }
      );
    }

    const template = await createTemplate(members[0].familyId, parsed.data);

    return NextResponse.json(
      { success: true, data: { template } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating timer template:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create template" },
      },
      { status: 500 }
    );
  }
}
