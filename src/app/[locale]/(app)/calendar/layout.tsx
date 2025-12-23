import { setRequestLocale } from "next-intl/server";
import { getSession } from "@/lib/get-session";
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

  const [members, chores, progress] = await Promise.all([
    getFamilyMembers(familyId),
    getChoresForFamily(familyId, { status: "pending" }),
    getChoreProgress(familyId),
  ]);

  return (
    <CalendarLayoutClient
      familyId={familyId}
      members={members}
      initialChores={chores}
      initialProgress={progress}
    >
      {children}
    </CalendarLayoutClient>
  );
}
