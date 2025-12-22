import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getSession } from "@/lib/get-session";
import { getUserFamily } from "@/server/services/family-service";
import { InviteMembersStep } from "@/components/family/onboarding/invite-members-step";

interface InvitePageProps {
  params: Promise<{ locale: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();

  // Auth check is handled by (auth)/layout.tsx
  const family = await getUserFamily(session!.user.id);

  if (!family) {
    redirect(`/${locale}/onboarding/create`);
  }

  return <InviteMembersStep familyId={family.id} locale={locale} />;
}
