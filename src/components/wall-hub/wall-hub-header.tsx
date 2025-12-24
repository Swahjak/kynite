"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { CalendarDays, CalendarRange, Calendar } from "lucide-react";

const tabs = [
  {
    href: "/calendar/today",
    icon: CalendarDays,
    labelKey: "today",
    mobileHidden: false,
  },
  {
    href: "/calendar/week",
    icon: CalendarRange,
    labelKey: "week",
    mobileHidden: false,
  },
  {
    href: "/calendar/full",
    icon: Calendar,
    labelKey: "calendar",
    mobileHidden: true,
  },
] as const;

export function WallHubHeader() {
  const pathname = usePathname();
  const t = useTranslations("WallHub");

  return (
    <div className="bg-background border-b px-4 py-3">
      <div className="flex items-center justify-center">
        <nav className="bg-muted inline-flex gap-1 rounded-lg p-1">
          {tabs.map(({ href, icon: Icon, labelKey, mobileHidden }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background hover:text-foreground",
                  mobileHidden ? "hidden md:inline-flex" : "inline-flex"
                )}
              >
                <Icon className="size-4" />
                {t(labelKey)}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
