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
import { Errors } from "@/lib/errors";

// GET /api/v1/timers/templates
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Errors.unauthorized();
    }

    // Get user's family
    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (members.length === 0) {
      return Errors.notFound("family");
    }

    const templates = await getTemplatesForFamily(members[0].familyId);

    return NextResponse.json({ success: true, data: { templates } });
  } catch (error) {
    console.error("Error fetching timer templates:", error);
    return Errors.internal(error);
  }
}

// POST /api/v1/timers/templates
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
    const parsed = createTimerTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return Errors.validation(parsed.error);
    }

    const template = await createTemplate(members[0].familyId, parsed.data);

    return NextResponse.json(
      { success: true, data: { template } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating timer template:", error);
    return Errors.internal(error);
  }
}
