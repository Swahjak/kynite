"use client";

import { useTranslations } from "next-intl";
import { useDashboard } from "../contexts/dashboard-context";
import { useGreeting } from "../hooks";
import { RefreshButton } from "../refresh-button";

export function GreetingClock() {
  const t = useTranslations("DashboardPage");
  const { currentTime } = useDashboard();
  const timeOfDay = useGreeting(currentTime);

  const formattedTime = currentTime.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex items-start justify-between py-4 md:py-6">
      <div>
        <p className="text-muted-foreground mb-1 text-base md:text-lg">
          {t(`greeting.${timeOfDay}`)}
        </p>
        <time
          dateTime={currentTime.toISOString()}
          suppressHydrationWarning
          className="text-4xl font-bold tracking-tight tabular-nums sm:text-5xl md:text-6xl"
        >
          {formattedTime}
        </time>
      </div>
      <RefreshButton />
    </div>
  );
}
