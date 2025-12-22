import { setRequestLocale } from "next-intl/server";
import { getSession } from "@/lib/get-session";
import { getFamilyMembers } from "@/server/services/family-service";
import { CalendarPageClient } from "./calendar-page-client";
import type { Locale } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function CalendarPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();
  const familyId = session?.session.familyId;

  // Family check is handled by (app)/layout.tsx, but we need familyId
  if (!familyId) {
    return null;
  }

  const members = await getFamilyMembers(familyId);

  return <CalendarPageClient familyId={familyId} members={members} />;
}
