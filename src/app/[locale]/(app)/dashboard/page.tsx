import { setRequestLocale } from "next-intl/server";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard/dashboard";
import { getDashboardData } from "@/components/dashboard/requests";
import type { Locale } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect(`/${locale}/sign-in`);
  }

  const dashboardData = await getDashboardData(session.user.id);

  return <Dashboard initialData={dashboardData} />;
}
