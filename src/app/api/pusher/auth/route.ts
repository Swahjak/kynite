import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import { pusherServer } from "@/lib/pusher";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const formData = await req.formData();
  const socketId = formData.get("socket_id") as string;
  const channel = formData.get("channel_name") as string;

  // Extract family ID from channel name
  const familyId = channel.replace("private-family-", "");

  // Verify user belongs to this family
  const members = await db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, session.user.id))
    .limit(1);

  if (members.length === 0 || members[0].familyId !== familyId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const authResponse = pusherServer.authorizeChannel(socketId, channel);
  return NextResponse.json(authResponse);
}
