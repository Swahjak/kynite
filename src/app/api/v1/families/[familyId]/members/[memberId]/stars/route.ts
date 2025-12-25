import { NextRequest, NextResponse } from "next/server";
import { getBalance, getHistory } from "@/server/services/star-service";
import { starHistoryQuerySchema } from "@/lib/validations/star";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { Errors } from "@/lib/errors";

type RouteParams = {
  params: Promise<{ familyId: string; memberId: string }>;
};

/**
 * GET /api/v1/families/[familyId]/members/[memberId]/stars
 * Get star balance and optionally history
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return Errors.unauthorized();
    }

    const { memberId } = await params;
    const { searchParams } = new URL(request.url);

    const balance = await getBalance(memberId);

    // If history requested
    if (searchParams.get("includeHistory") === "true") {
      const queryResult = starHistoryQuerySchema.safeParse({
        limit: searchParams.get("limit")
          ? parseInt(searchParams.get("limit")!)
          : undefined,
        offset: searchParams.get("offset")
          ? parseInt(searchParams.get("offset")!)
          : undefined,
        type: searchParams.get("type") ?? undefined,
      });

      if (!queryResult.success) {
        return Errors.validation(queryResult.error.flatten());
      }

      const history = await getHistory(memberId, queryResult.data);
      return NextResponse.json({ balance, history });
    }

    return NextResponse.json({ balance });
  } catch (error) {
    console.error("Error fetching star balance:", error);
    return Errors.internal("Failed to fetch star balance");
  }
}
