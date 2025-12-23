import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { isUserFamilyManager } from "@/server/services/family-service";
import {
  reorderTasks,
  getChartWithDetails,
} from "@/server/services/reward-chart-service";
import { reorderTasksSchema } from "@/lib/validations/reward-chart";

type Params = { params: Promise<{ familyId: string; chartId: string }> };

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
            message: "Only managers can reorder tasks",
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
    const parsed = reorderTasksSchema.safeParse(body);

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

    await reorderTasks(chartId, parsed.data.taskIds);

    return NextResponse.json({
      success: true,
      data: { taskIds: parsed.data.taskIds },
    });
  } catch (error) {
    console.error("Error reordering tasks:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to reorder tasks" },
      },
      { status: 500 }
    );
  }
}
