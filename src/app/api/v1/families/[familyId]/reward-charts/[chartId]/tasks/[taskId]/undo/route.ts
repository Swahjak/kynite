import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { isUserFamilyMember } from "@/server/services/family-service";
import {
  undoCompletion,
  getChartWithDetails,
} from "@/server/services/reward-chart-service";
import { format } from "date-fns";

type Params = {
  params: Promise<{ familyId: string; chartId: string; taskId: string }>;
};

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

    const { familyId, chartId, taskId } = await params;

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

    const task = chart.tasks.find((t) => t.id === taskId);
    if (!task) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        },
        { status: 404 }
      );
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const result = await undoCompletion(taskId, today);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error undoing completion:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to undo completion" },
      },
      { status: 500 }
    );
  }
}
