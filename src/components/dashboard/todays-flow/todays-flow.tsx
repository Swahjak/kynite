"use client";

import { useTranslations } from "next-intl";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useDashboard } from "../contexts/dashboard-context";
import { EventCard } from "./event-card";

export function TodaysFlow() {
  const t = useTranslations("DashboardPage.todaysFlow");
  const { nowEvent, nextEvent, laterEvents, eventsRemaining } = useDashboard();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="text-muted-foreground h-5 w-5" />
          <h2 className="text-lg font-semibold">{t("title")}</h2>
        </div>
        <Badge variant="secondary">
          {t("eventsRemaining", { count: eventsRemaining })}
        </Badge>
      </div>

      <div className="space-y-3">
        {nowEvent && (
          <div>
            <p className="text-primary mb-1 text-xs font-medium tracking-wide uppercase">
              {t("now")}
            </p>
            <EventCard event={nowEvent} state="NOW" />
          </div>
        )}

        {nextEvent && (
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
              {t("next")}
            </p>
            <EventCard event={nextEvent} state="NEXT" />
          </div>
        )}

        {laterEvents.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
              {t("later")}
            </p>
            <div className="space-y-2">
              {laterEvents.map((event) => (
                <EventCard key={event.id} event={event} state="LATER" />
              ))}
            </div>
          </div>
        )}

        {!nowEvent && !nextEvent && laterEvents.length === 0 && (
          <p className="text-muted-foreground py-8 text-center">
            {t("noEvents")}
          </p>
        )}
      </div>
    </section>
  );
}
