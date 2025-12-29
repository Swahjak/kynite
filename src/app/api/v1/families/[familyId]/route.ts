// src/app/api/v1/families/[familyId]/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  families,
  familyMembers,
  users,
  googleCalendars,
} from "@/server/schema";
import { eq, inArray } from "drizzle-orm";
import { updateFamilySchema } from "@/lib/validations/family";
import {
  getFamilyMembers,
  isUserFamilyMember,
  isUserFamilyManager,
} from "@/server/services/family-service";
import { stopWatchChannel } from "@/server/services/google-channel-service";
import { Errors } from "@/lib/errors";

type Params = { params: Promise<{ familyId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Errors.unauthorized();
    }

    const { familyId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return Errors.notFamilyMember();
    }

    const family = await db
      .select()
      .from(families)
      .where(eq(families.id, familyId))
      .limit(1);

    if (family.length === 0) {
      return Errors.notFound("family");
    }

    const members = await getFamilyMembers(familyId);
    const currentMember = members.find((m) => m.userId === session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        family: family[0],
        members,
        currentUserRole: currentMember?.role,
      },
    });
  } catch (error) {
    console.error("Error getting family:", error);
    return Errors.internal();
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Errors.unauthorized();
    }

    const { familyId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return Errors.managerRequired();
    }

    const body = await request.json();
    const parsed = updateFamilySchema.safeParse(body);

    if (!parsed.success) {
      return Errors.validation(parsed.error);
    }

    await db
      .update(families)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(eq(families.id, familyId));

    const family = await db
      .select()
      .from(families)
      .where(eq(families.id, familyId))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: { family: family[0] },
    });
  } catch (error) {
    console.error("Error updating family:", error);
    return Errors.internal();
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Errors.unauthorized();
    }

    const { familyId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return Errors.managerRequired();
    }

    // Use transaction for atomicity
    await db.transaction(async (tx) => {
      // 1. Collect all user IDs before deleting family
      const members = await tx
        .select({ userId: familyMembers.userId })
        .from(familyMembers)
        .where(eq(familyMembers.familyId, familyId));

      const userIds = members.map((m) => m.userId);

      // 2. Stop all Google push channels for calendars in this family
      const calendars = await tx
        .select({ id: googleCalendars.id })
        .from(googleCalendars)
        .where(eq(googleCalendars.familyId, familyId));

      for (const calendar of calendars) {
        try {
          await stopWatchChannel(calendar.id);
        } catch (error) {
          // Log but continue - channel will expire naturally
          console.error(
            `Failed to stop channel for calendar ${calendar.id}:`,
            error
          );
        }
      }

      // 3. Delete family (cascades to familyMembers, calendars, events, etc.)
      await tx.delete(families).where(eq(families.id, familyId));

      // 4. Delete all user accounts
      if (userIds.length > 0) {
        await tx.delete(users).where(inArray(users.id, userIds));
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting family:", error);
    return Errors.internal();
  }
}
