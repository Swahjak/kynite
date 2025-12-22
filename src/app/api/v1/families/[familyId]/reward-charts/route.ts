import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import {
  isUserFamilyMember,
  isUserFamilyManager,
} from "@/server/services/family-service";
import {
  getChartsForFamily,
  createChart,
} from "@/server/services/reward-chart-service";
import { createRewardChartSchema } from "@/lib/validations/reward-chart";

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

    const charts = await getChartsForFamily(familyId);

    return NextResponse.json({
      success: true,
      data: { charts },
    });
  } catch (error) {
    console.error("Error getting reward charts:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get reward charts",
        },
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
            message: "Only managers can create reward charts",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createRewardChartSchema.safeParse(body);

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

    const chart = await createChart(familyId, parsed.data.memberId);

    return NextResponse.json(
      { success: true, data: { chart } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating reward chart:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create reward chart";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
