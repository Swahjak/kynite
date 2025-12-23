"use client";

import { Star, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface StarBalanceCardProps {
  balance: number;
  weeklyDelta: number;
  className?: string;
}

export function StarBalanceCard({
  balance,
  weeklyDelta,
  className,
}: StarBalanceCardProps) {
  const t = useTranslations("rewardStore");

  return (
    <div
      className={cn(
        "from-primary/10 to-primary/5 relative overflow-hidden rounded-2xl bg-gradient-to-br p-6",
        className
      )}
    >
      <div className="bg-primary/10 absolute -top-6 -right-6 h-24 w-24 rounded-full blur-2xl" />

      <div className="relative">
        <p className="text-muted-foreground text-sm font-medium">
          {t("yourBalance")}
        </p>

        <div className="mt-2 flex items-baseline gap-2">
          <Star className="fill-primary text-primary h-8 w-8" />
          <span className="text-foreground text-4xl font-bold">{balance}</span>
        </div>

        {weeklyDelta !== 0 && (
          <div className="mt-3 flex items-center gap-1 text-sm">
            {weeklyDelta > 0 ? (
              <>
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-green-600">+{weeklyDelta}</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className="text-red-600">{weeklyDelta}</span>
              </>
            )}
            <span className="text-muted-foreground">{t("starsThisWeek")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
