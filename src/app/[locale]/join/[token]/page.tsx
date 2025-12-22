import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getSession } from "@/lib/get-session";
import { JoinFamilyClient } from "@/components/family/join-family-client";

interface JoinPageProps {
  params: Promise<{ locale: string; token: string }>;
}

export default async function JoinPage({ params }: JoinPageProps) {
  const { locale, token } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();

  if (!session?.user) {
    // Redirect to login with callback to this page
    redirect(`/${locale}/login?callbackUrl=/${locale}/join/${token}`);
  }

  return <JoinFamilyClient token={token} locale={locale} />;
}
