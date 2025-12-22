"use client";

import { useTranslations } from "next-intl";
import { useDashboard } from "../contexts/dashboard-context";
import { useGreeting } from "../hooks";

export function GreetingClock() {
  const t = useTranslations("DashboardPage");
  const { currentTime } = useDashboard();
  const timeOfDay = useGreeting(currentTime);

  const formattedTime = currentTime.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="py-8 text-center">
      <p className="text-muted-foreground mb-2 text-lg">
        {t(`greeting.${timeOfDay}`)}
      </p>
      <time
        dateTime={currentTime.toISOString()}
        suppressHydrationWarning
        className="text-5xl font-bold tracking-tight tabular-nums sm:text-6xl lg:text-7xl"
      >
        {formattedTime}
      </time>
    </div>
  );
}
