"use client";

import { useTranslations } from "next-intl";
import { Timer } from "lucide-react";
import { useDashboard } from "../contexts/dashboard-context";
import { TimerCard } from "./timer-card";

export function ActiveTimers() {
  const t = useTranslations("DashboardPage.activeTimers");
  const { activeTimers } = useDashboard();

  if (activeTimers.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Timer className="text-muted-foreground h-4 w-4" />
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {t("title")}
        </h2>
      </div>

      <div className="space-y-2">
        {activeTimers.map((timer) => (
          <TimerCard key={timer.id} timer={timer} />
        ))}
      </div>
    </section>
  );
}
