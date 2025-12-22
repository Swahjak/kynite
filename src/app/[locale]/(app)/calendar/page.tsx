import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getEvents, getUsers } from "@/components/calendar/requests";
import { CalendarPageClient } from "./calendar-page-client";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function CalendarPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const [events, users] = await Promise.all([getEvents(), getUsers()]);

  return <CalendarPageClient events={events} users={users} />;
}
