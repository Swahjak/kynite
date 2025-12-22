import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import {
  isUserFamilyMember,
  isUserFamilyManager,
} from "@/server/services/family-service";
import {
  getEventById,
  updateEvent,
  deleteEvent,
} from "@/server/services/event-service";
import { updateEventSchema } from "@/lib/validations/event";

type Params = { params: Promise<{ familyId: string; eventId: string }> };

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

    const { familyId, eventId } = await params;

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

    const event = await getEventById(eventId, familyId);
    if (!event) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Event not found" },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { event },
    });
  } catch (error) {
    console.error("Error getting event:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to get event" },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
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

    const { familyId, eventId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can edit events",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateEventSchema.partial().safeParse(body);

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

    const event = await updateEvent(eventId, familyId, parsed.data);

    return NextResponse.json({
      success: true,
      data: { event },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update event";
    console.error("Error updating event:", error);

    if (message.includes("read-only")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message },
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
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

    const { familyId, eventId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can delete events",
          },
        },
        { status: 403 }
      );
    }

    await deleteEvent(eventId, familyId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete event";
    console.error("Error deleting event:", error);

    if (message.includes("read-only")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message },
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message },
      },
      { status: 500 }
    );
  }
}
