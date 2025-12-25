// src/app/api/v1/families/[familyId]/children/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { isUserFamilyManager } from "@/server/services/family-service";
import {
  createChildMember,
  countChildrenInFamily,
} from "@/server/services/child-service";
import { createChildSchema } from "@/lib/validations/family";
import { Errors } from "@/lib/errors";

const MAX_CHILDREN_PER_FAMILY = 10;

type Params = { params: Promise<{ familyId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Errors.unauthorized();
    }

    const { familyId } = await params;

    // Only managers can add children
    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return Errors.managerRequired();
    }

    const body = await request.json();
    const parsed = createChildSchema.safeParse(body);

    if (!parsed.success) {
      return Errors.validation(parsed.error.flatten());
    }

    // Check child limit
    const childCount = await countChildrenInFamily(familyId);
    if (childCount >= MAX_CHILDREN_PER_FAMILY) {
      return Errors.validation({
        _errors: [`Maximum of ${MAX_CHILDREN_PER_FAMILY} children per family`],
      });
    }

    const { user, member } = await createChildMember(
      familyId,
      parsed.data.name,
      parsed.data.avatarColor
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          member: {
            id: member.id,
            familyId: member.familyId,
            userId: member.userId,
            role: member.role,
            displayName: member.displayName,
            avatarColor: member.avatarColor,
            createdAt: member.createdAt,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
            },
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating child member:", error);
    return Errors.internal("Failed to create child member");
  }
}
