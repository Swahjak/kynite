import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getSession } from "@/lib/get-session";
import { getUserFamily } from "@/server/services/family-service";

interface OnboardingPageProps {
  params: Promise<{ locale: string }>;
}

export default async function OnboardingPage({ params }: OnboardingPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  // Check if user already has a family
  const family = await getUserFamily(session.user.id);

  if (family) {
    // User has a family, redirect to calendar
    redirect(`/${locale}/calendar`);
  }

  // User needs to create/join a family
  redirect(`/${locale}/onboarding/create`);
}
