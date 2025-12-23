import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { rewardChartGoals, rewardCharts, familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateGoalSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  emoji: z.string().optional(),
  starTarget: z.number().int().min(5).max(100).optional(),
  status: z.enum(["active", "achieved", "cancelled"]).optional(),
});

type RouteContext = {
  params: Promise<{ familyId: string; chartId: string; goalId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { familyId, chartId, goalId } = await context.params;

  // Verify manager role
  const member = await db.query.familyMembers.findFirst({
    where: and(
      eq(familyMembers.familyId, familyId),
      eq(familyMembers.userId, session.user.id)
    ),
  });

  if (!member || member.role !== "manager") {
    return NextResponse.json(
      { success: false, error: { message: "Forbidden" } },
      { status: 403 }
    );
  }

  // Verify chart belongs to family
  const chart = await db.query.rewardCharts.findFirst({
    where: and(
      eq(rewardCharts.id, chartId),
      eq(rewardCharts.familyId, familyId)
    ),
  });

  if (!chart) {
    return NextResponse.json(
      { success: false, error: { message: "Chart not found" } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = updateGoalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { message: parsed.error.message } },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.description !== undefined)
    updateData.description = parsed.data.description;
  if (parsed.data.emoji !== undefined) updateData.emoji = parsed.data.emoji;
  if (parsed.data.starTarget !== undefined)
    updateData.starTarget = parsed.data.starTarget;
  if (parsed.data.status !== undefined) {
    updateData.status = parsed.data.status;
    if (parsed.data.status === "achieved") {
      updateData.achievedAt = new Date();
    }
  }

  const [updated] = await db
    .update(rewardChartGoals)
    .set(updateData)
    .where(
      and(
        eq(rewardChartGoals.id, goalId),
        eq(rewardChartGoals.chartId, chartId)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json(
      { success: false, error: { message: "Goal not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: { goal: updated } });
}
