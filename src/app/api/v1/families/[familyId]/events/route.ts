import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import {
  isUserFamilyMember,
  isUserFamilyManager,
  getMemberByUserId,
} from "@/server/services/family-service";
import {
  getEventsForFamily,
  createEvent,
} from "@/server/services/event-service";
import { createEventSchema, eventQuerySchema } from "@/lib/validations/event";

type Params = { params: Promise<{ familyId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Not a member of this family" },
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = eventQuerySchema.safeParse({
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      participantIds: searchParams.getAll("participantIds"),
      colors: searchParams.getAll("colors"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0].message,
          },
        },
        { status: 400 }
      );
    }

    const events = await getEventsForFamily(
      familyId,
      parsed.data,
      session.user.id // Pass viewer's user ID for privacy filtering
    );

    return NextResponse.json({
      success: true,
      data: { events },
    });
  } catch (error) {
    console.error("Error getting events:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to get events" },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can create events",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0].message,
          },
        },
        { status: 400 }
      );
    }

    const member = await getMemberByUserId(session.user.id, familyId);
    if (!member) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Member not found" },
        },
        { status: 404 }
      );
    }

    const event = await createEvent(familyId, parsed.data, member.id);

    return NextResponse.json(
      { success: true, data: { event } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create event" },
      },
      { status: 500 }
    );
  }
}
