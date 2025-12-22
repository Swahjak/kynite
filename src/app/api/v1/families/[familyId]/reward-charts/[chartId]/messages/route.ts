import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import {
  isUserFamilyManager,
  isUserFamilyMember,
  getFamilyMemberByUserId,
} from "@/server/services/family-service";
import {
  createMessage,
  getActiveMessage,
  getChartWithDetails,
} from "@/server/services/reward-chart-service";
import { createRewardChartMessageSchema } from "@/lib/validations/reward-chart";

type Params = { params: Promise<{ familyId: string; chartId: string }> };

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

    const { familyId, chartId } = await params;

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

    const chart = await getChartWithDetails(chartId);
    if (!chart || chart.familyId !== familyId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Chart not found" },
        },
        { status: 404 }
      );
    }

    const message = await getActiveMessage(chartId);

    return NextResponse.json({
      success: true,
      data: { message },
    });
  } catch (error) {
    console.error("Error getting message:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to get message" },
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

    const { familyId, chartId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can send messages",
          },
        },
        { status: 403 }
      );
    }

    const chart = await getChartWithDetails(chartId);
    if (!chart || chart.familyId !== familyId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Chart not found" },
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = createRewardChartMessageSchema.safeParse(body);

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

    // Get author's family member ID
    const member = await getFamilyMemberByUserId(session.user.id, familyId);
    if (!member) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Not a member of this family" },
        },
        { status: 403 }
      );
    }

    const message = await createMessage(chartId, member.id, parsed.data);

    return NextResponse.json(
      { success: true, data: { message } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating message:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create message" },
      },
      { status: 500 }
    );
  }
}
