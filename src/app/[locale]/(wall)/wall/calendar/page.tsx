import { setRequestLocale } from "next-intl/server";
import { type Locale } from "@/i18n/routing";
import { WallCalendarPageClient } from "./wall-calendar-page-client";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function WallCalendarPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return <WallCalendarPageClient />;
}
