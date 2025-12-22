// src/app/[locale]/settings/family/page.tsx

import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getSession } from "@/lib/get-session";
import {
  getUserFamily,
  getFamilyMembers,
} from "@/server/services/family-service";
import { FamilySettingsClient } from "@/components/family/family-settings-client";

interface FamilySettingsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function FamilySettingsPage({
  params,
}: FamilySettingsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const family = await getUserFamily(session.user.id);

  if (!family) {
    redirect(`/${locale}/onboarding`);
  }

  const members = await getFamilyMembers(family.id);

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Family Settings</h1>
          <p className="text-muted-foreground">
            Manage your family and members
          </p>
        </div>
        <FamilySettingsClient
          family={family}
          members={members}
          currentUserId={session.user.id}
          isManager={family.currentUserRole === "manager"}
          locale={locale}
        />
      </div>
    </div>
  );
}
