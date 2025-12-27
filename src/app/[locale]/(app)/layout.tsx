import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getSession } from "@/lib/get-session";
import { AppShell } from "@/components/layout/app-shell";
import { CacheStatusIndicator } from "@/components/status";
import type { Locale } from "@/i18n/routing";

interface AppLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AppLayout({ children, params }: AppLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();

  // Middleware handles auth redirect, but keep as fallback
  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  // No family - redirect to onboarding
  if (!session.session.familyId) {
    redirect(`/${locale}/onboarding`);
  }

  return (
    <>
      <AppShell>{children}</AppShell>
      <CacheStatusIndicator />
    </>
  );
}
