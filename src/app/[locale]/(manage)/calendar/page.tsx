import { setRequestLocale } from "next-intl/server";
import { Calendar } from "@/components/calendar/calendar";
import { type Locale } from "@/i18n/routing";
import { CalendarPageClient } from "./calendar-page-client";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function CalendarPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return <CalendarPageClient />;
}
