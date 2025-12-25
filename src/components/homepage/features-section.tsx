"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { CalendarDays, Gamepad2, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const colorClasses = {
  primary: {
    icon: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
    border: "hover:border-primary/50",
  },
  purple: {
    icon: "bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white dark:bg-purple-900/50 dark:text-purple-400",
    border: "hover:border-purple-200 dark:hover:border-purple-800",
  },
  orange: {
    icon: "bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white dark:bg-orange-900/50 dark:text-orange-400",
    border: "hover:border-orange-200 dark:hover:border-orange-800",
  },
} as const;

const features = [
  { key: "calendar" as const, icon: CalendarDays, color: "primary" as const },
  { key: "routines" as const, icon: Gamepad2, color: "purple" as const },
  { key: "meals" as const, icon: UtensilsCrossed, color: "orange" as const },
] as const;

export function FeaturesSection() {
  const t = useTranslations("HomePage.features");

  return (
    <section id="features" className="bg-card border-y py-16">
      <div className="container mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {t("title")}
          </h2>
          <p className="text-muted-foreground mt-4 text-lg">{t("subtitle")}</p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.key}
              className={cn(
                "group bg-background relative rounded-2xl border p-8 transition-all duration-300 hover:shadow-lg",
                colorClasses[feature.color].border
              )}
            >
              <div
                className={cn(
                  "mb-6 inline-flex size-14 items-center justify-center rounded-xl shadow-sm transition-colors",
                  colorClasses[feature.color].icon
                )}
              >
                <Icon icon={feature.icon} size="lg" />
              </div>
              <h3 className="font-display mb-3 text-xl font-bold">
                {t(`${feature.key}.title`)}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {t(`${feature.key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
