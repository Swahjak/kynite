"use client";

import { useTranslations } from "next-intl";
import { useDashboard } from "../contexts/dashboard-context";
import { useGreeting } from "../hooks";

export function Greeting() {
  const t = useTranslations("DashboardPage");
  const { currentTime } = useDashboard();
  const timeOfDay = useGreeting(currentTime);

  return (
    <p className="text-muted-foreground text-base md:text-lg">
      {t(`greeting.${timeOfDay}`)}
    </p>
  );
}
