"use client";

import { useTranslations } from "next-intl";
import { ClipboardList, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useDashboard } from "../contexts/dashboard-context";
import type { DashboardChore, ChoreUrgency } from "../types";

function getUrgencyVariant(
  urgency: ChoreUrgency
): "destructive" | "outline" | "secondary" | "default" {
  switch (urgency) {
    case "overdue":
    case "urgent":
      return "destructive";
    case "due-soon":
      return "outline";
    default:
      return "secondary";
  }
}

function formatTime(time: string | null): string | null {
  if (!time) return null;
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

interface ChoreItemProps {
  chore: DashboardChore;
  urgencyLabel: string;
}

function ChoreItem({ chore, urgencyLabel }: ChoreItemProps) {
  const badgeVariant = getUrgencyVariant(chore.urgency);
  const formattedTime = formatTime(chore.dueTime);

  return (
    <div className="bg-card flex items-center gap-3 rounded-lg border p-3">
      {/* Avatar */}
      {chore.assignee && (
        <Avatar className="h-10 w-10">
          <AvatarFallback
            style={{ backgroundColor: chore.assignee.avatarColor }}
            className="text-sm font-medium text-white"
          >
            {chore.assignee.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <h4 className="truncate font-medium">{chore.title}</h4>
        <div className="mt-0.5 flex items-center gap-2">
          {chore.urgency !== "none" && (
            <Badge
              variant={badgeVariant}
              className="text-xs font-bold uppercase"
            >
              {urgencyLabel}
            </Badge>
          )}
          {formattedTime && (
            <span className="text-muted-foreground text-xs">
              {formattedTime}
            </span>
          )}
          {chore.assignee && (
            <span className="text-muted-foreground text-xs">
              {chore.assignee.name}
            </span>
          )}
        </div>
      </div>

      {/* Star reward */}
      <div className="flex items-center gap-1 text-amber-500">
        <Star className="h-4 w-4 fill-current" />
        <span className="text-sm font-medium">{chore.starReward}</span>
      </div>
    </div>
  );
}

export function TodaysChores() {
  const t = useTranslations("DashboardPage.todaysChores");
  const { todaysChores, choresRemaining } = useDashboard();

  // Group chores by urgency
  const urgentChores = todaysChores.filter(
    (c) => c.urgency === "overdue" || c.urgency === "urgent"
  );
  const dueSoonChores = todaysChores.filter((c) => c.urgency === "due-soon");
  const regularChores = todaysChores.filter((c) => c.urgency === "none");

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="text-muted-foreground h-5 w-5" />
          <h2 className="text-lg font-semibold">{t("title")}</h2>
        </div>
        <Badge variant="secondary">
          {t("choresRemaining", { count: choresRemaining })}
        </Badge>
      </div>

      <div className="space-y-3">
        {urgentChores.length > 0 && (
          <div>
            <p className="text-destructive mb-1 text-xs font-medium tracking-wide uppercase">
              {t("urgent")}
            </p>
            <div className="space-y-2">
              {urgentChores.map((chore) => (
                <ChoreItem
                  key={chore.id}
                  chore={chore}
                  urgencyLabel={
                    chore.urgency === "overdue"
                      ? t("overdue")
                      : t("urgentBadge")
                  }
                />
              ))}
            </div>
          </div>
        )}

        {dueSoonChores.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
              {t("dueSoon")}
            </p>
            <div className="space-y-2">
              {dueSoonChores.map((chore) => (
                <ChoreItem
                  key={chore.id}
                  chore={chore}
                  urgencyLabel={t("dueSoonBadge")}
                />
              ))}
            </div>
          </div>
        )}

        {regularChores.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
              {t("today")}
            </p>
            <div className="space-y-2">
              {regularChores.map((chore) => (
                <ChoreItem key={chore.id} chore={chore} urgencyLabel="" />
              ))}
            </div>
          </div>
        )}

        {todaysChores.length === 0 && (
          <p className="text-muted-foreground py-8 text-center">
            {t("noChores")}
          </p>
        )}
      </div>
    </section>
  );
}
