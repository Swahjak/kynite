import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { unstable_noStore as noStore } from "next/cache";
import { getSession } from "@/lib/get-session";
import { getUserFamily } from "@/server/services/family-service";
import { InteractionModeProvider } from "@/contexts/interaction-mode-context";
import { AddEventProvider } from "@/contexts/add-event-context";
import { AppShell } from "@/components/layout/app-shell";
import type { Locale } from "@/i18n/routing";

interface AppLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AppLayout({ children, params }: AppLayoutProps) {
  noStore(); // Disable caching - session must be checked fresh each request

  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();

  // DEBUG: Throw error with session info instead of redirecting
  if (!session?.user) {
    throw new Error(
      `[AppLayout] Session check failed. Has session: ${!!session}, BETTER_AUTH_URL: ${process.env.BETTER_AUTH_URL}`
    );
  }

  // No family - redirect to onboarding
  if (!session.session.familyId) {
    redirect(`/${locale}/onboarding`);
  }

  // Get user's role in the family
  const family = await getUserFamily(session.user.id);
  const isManager = family?.currentUserRole === "manager";

  return (
    <InteractionModeProvider>
      <AddEventProvider>
        <AppShell isManager={isManager}>{children}</AppShell>
      </AddEventProvider>
    </InteractionModeProvider>
  );
}
