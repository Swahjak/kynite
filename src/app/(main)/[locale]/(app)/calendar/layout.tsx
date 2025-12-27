import { setRequestLocale } from "next-intl/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/server/db";
import { users } from "@/server/schema";
import { getFamilyMembers } from "@/server/services/family-service";
import {
  getChoresForFamily,
  getChoreProgress,
} from "@/server/services/chore-service";
import { CalendarLayoutClient } from "./calendar-layout-client";
import type { Locale } from "@/i18n/routing";

interface CalendarLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function CalendarLayout({
  children,
  params,
}: CalendarLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();
  const familyId = session?.session.familyId;

  if (!familyId) {
    return null;
  }

  const [members, chores, progress, userPrefs] = await Promise.all([
    getFamilyMembers(familyId),
    getChoresForFamily(familyId, { status: "pending" }),
    getChoreProgress(familyId),
    db
      .select({ use24HourFormat: users.use24HourFormat })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1),
  ]);

  return (
    <CalendarLayoutClient
      familyId={familyId}
      members={members}
      initialChores={chores}
      initialProgress={progress}
      initialUse24HourFormat={userPrefs[0]?.use24HourFormat ?? true}
    >
      {children}
    </CalendarLayoutClient>
  );
}
