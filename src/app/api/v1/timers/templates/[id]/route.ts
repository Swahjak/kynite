import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import {
  getTemplateById,
  updateTemplate,
  deleteTemplate,
} from "@/server/services/timer-template-service";
import { updateTimerTemplateSchema } from "@/lib/validations/timer";

type Params = Promise<{ id: string }>;

// GET /api/v1/timers/templates/[id]
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

    const template = await getTemplateById(id, members[0].familyId);

    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Template not found" },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { template } });
  } catch (error) {
    console.error("Error fetching timer template:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch template" },
      },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/timers/templates/[id]
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

    const body = await request.json();
    const parsed = updateTimerTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.message },
        },
        { status: 400 }
      );
    }

    const template = await updateTemplate(id, members[0].familyId, parsed.data);

    return NextResponse.json({ success: true, data: { template } });
  } catch (error) {
    console.error("Error updating timer template:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to update template" },
      },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/timers/templates/[id]
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

    await deleteTemplate(id, members[0].familyId);

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    console.error("Error deleting timer template:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to delete template" },
      },
      { status: 500 }
    );
  }
}
