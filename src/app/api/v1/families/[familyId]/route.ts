// src/app/api/v1/families/[familyId]/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { families, familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { updateFamilySchema } from "@/lib/validations/family";
import {
  getFamilyMembers,
  isUserFamilyMember,
  isUserFamilyManager,
} from "@/server/services/family-service";
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

    // Delete family (cascade will delete members and invites)
    await db.delete(families).where(eq(families.id, familyId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting family:", error);
    return Errors.internal();
  }
}
