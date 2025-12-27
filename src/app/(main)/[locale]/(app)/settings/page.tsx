import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getSession, isDeviceSession } from "@/lib/get-session";
import {
  getUserFamily,
  getFamilyMembers,
} from "@/server/services/family-service";
import { SettingsPageClient } from "@/components/settings/settings-page-client";

interface SettingsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  // Device accounts cannot access settings
  if (await isDeviceSession()) {
    redirect(`/${locale}/dashboard`);
  }

  const family = await getUserFamily(session.user.id);

  if (!family) {
    redirect(`/${locale}/onboarding`);
  }

  const members = await getFamilyMembers(family.id);

  return (
    <SettingsPageClient
      family={family}
      members={members}
      currentUserId={session.user.id}
      isManager={family.currentUserRole === "manager"}
      locale={locale}
    />
  );
}
