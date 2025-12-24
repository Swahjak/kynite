import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { getNonDeviceSession } from "@/lib/api-auth";
import {
  isUserFamilyMember,
  isUserFamilyManager,
} from "@/server/services/family-service";
import {
  getChoreById,
  updateChore,
  deleteChore,
} from "@/server/services/chore-service";
import { updateChoreSchema } from "@/lib/validations/chore";

type Params = { params: Promise<{ familyId: string; choreId: string }> };

export async function GET(_request: Request, { params }: Params) {
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

    const { familyId, choreId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Not a family member" },
        },
        { status: 403 }
      );
    }

    const chore = await getChoreById(choreId, familyId);
    if (!chore) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Chore not found" },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { chore } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch chore";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { session, errorResponse } = await getNonDeviceSession();
    if (errorResponse) return errorResponse;

    const { familyId, choreId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can update chores",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateChoreSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.message },
        },
        { status: 400 }
      );
    }

    const chore = await updateChore(choreId, familyId, parsed.data);

    return NextResponse.json({ success: true, data: { chore } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update chore";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { session, errorResponse } = await getNonDeviceSession();
    if (errorResponse) return errorResponse;

    const { familyId, choreId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can delete chores",
          },
        },
        { status: 403 }
      );
    }

    await deleteChore(choreId, familyId);

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete chore";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
