import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getSession } from "@/lib/get-session";
import { getUserFamily } from "@/server/services/family-service";
import { CreateFamilyForm } from "@/components/family/onboarding/create-family-form";

interface CreatePageProps {
  params: Promise<{ locale: string }>;
}

export default async function CreatePage({ params }: CreatePageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  // Check if user already has a family
  const family = await getUserFamily(session.user.id);

  if (family) {
    redirect(`/${locale}/calendar`);
  }

  return <CreateFamilyForm locale={locale} />;
}
