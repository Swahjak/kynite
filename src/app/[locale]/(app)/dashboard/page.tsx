import { setRequestLocale } from "next-intl/server";
import { Dashboard } from "@/components/dashboard/dashboard";
import type { Locale } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return <Dashboard />;
}
