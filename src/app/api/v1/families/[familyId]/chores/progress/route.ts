import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { isUserFamilyMember } from "@/server/services/family-service";
import { getChoreProgress } from "@/server/services/chore-service";

type Params = { params: Promise<{ familyId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { familyId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Not a family member" } },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const date = url.searchParams.get("date") ?? undefined;

    const progress = await getChoreProgress(familyId, date);

    return NextResponse.json({ success: true, data: { progress } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch progress";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
