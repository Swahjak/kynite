import { setRequestLocale } from "next-intl/server";
import { type Locale } from "@/i18n/routing";
import { getEvents, getUsers } from "@/components/calendar/requests";
import { WallCalendarPageClient } from "./wall-calendar-page-client";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function WallCalendarPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const [events, users] = await Promise.all([getEvents(), getUsers()]);

  return <WallCalendarPageClient events={events} users={users} />;
}
