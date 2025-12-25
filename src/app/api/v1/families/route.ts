// src/app/api/v1/families/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { createFamilySchema } from "@/lib/validations/family";
import { createFamily } from "@/server/services/family-service";
import { db } from "@/server/db";
import { families, familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import { Errors } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Errors.unauthorized();
    }

    const body = await request.json();
    const parsed = createFamilySchema.safeParse(body);

    if (!parsed.success) {
      return Errors.validation(parsed.error);
    }

    const result = await createFamily(session.user.id, parsed.data.name);

    return NextResponse.json(
      {
        success: true,
        data: {
          family: result.family,
          membership: result.membership,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating family:", error);
    return Errors.internal();
  }
}

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Errors.unauthorized();
    }

    const userFamilies = await db
      .select({
        id: families.id,
        name: families.name,
        createdAt: families.createdAt,
        updatedAt: families.updatedAt,
        role: familyMembers.role,
      })
      .from(families)
      .innerJoin(familyMembers, eq(families.id, familyMembers.familyId))
      .where(eq(familyMembers.userId, session.user.id));

    return NextResponse.json({
      success: true,
      data: { families: userFamilies },
    });
  } catch (error) {
    console.error("Error listing families:", error);
    return Errors.internal();
  }
}
