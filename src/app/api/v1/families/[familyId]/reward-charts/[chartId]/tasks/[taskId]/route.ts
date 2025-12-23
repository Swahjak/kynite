import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { isUserFamilyManager } from "@/server/services/family-service";
import {
  updateTask,
  deleteTask,
  getChartWithDetails,
} from "@/server/services/reward-chart-service";
import { updateRewardChartTaskSchema } from "@/lib/validations/reward-chart";

type Params = {
  params: Promise<{ familyId: string; chartId: string; taskId: string }>;
};

export async function PUT(request: Request, { params }: Params) {
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

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can update tasks",
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
    const parsed = updateRewardChartTaskSchema.safeParse(body);

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

    const task = await updateTask(taskId, parsed.data);

    if (!task) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { task } });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to update task" },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
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

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can delete tasks",
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

    await deleteTask(taskId);

    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to delete task" },
      },
      { status: 500 }
    );
  }
}
