import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { isUserFamilyMember, getFamilyMemberByUserId } from "@/server/services/family-service";
import { completeChore, undoChoreCompletion } from "@/server/services/chore-service";

type Params = { params: Promise<{ familyId: string; choreId: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { familyId, choreId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Not a family member" } },
        { status: 403 }
      );
    }

    // Get the current user's family member ID
    const member = await getFamilyMemberByUserId(session.user.id, familyId);
    if (!member) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Member not found" } },
        { status: 403 }
      );
    }

    const chore = await completeChore(choreId, familyId, member.id);

    return NextResponse.json({
      success: true,
      data: { chore, starsEarned: chore.starReward },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to complete chore";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { familyId, choreId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Not a family member" } },
        { status: 403 }
      );
    }

    const chore = await undoChoreCompletion(choreId, familyId);

    return NextResponse.json({ success: true, data: { chore } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to undo completion";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
