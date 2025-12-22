import { setRequestLocale } from "next-intl/server";
import { Dashboard } from "@/components/dashboard/dashboard";
import { AppHeader } from "@/components/layout/app-header";
import { InteractionModeProvider } from "@/contexts/interaction-mode-context";
import type { Locale } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    <InteractionModeProvider mode="manage">
      <main className="bg-background flex min-h-screen flex-col">
        <AppHeader />
        <Dashboard />
      </main>
    </InteractionModeProvider>
  );
}
