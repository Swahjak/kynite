"use client";

import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "../contexts/dashboard-context";
import { ActionButton } from "./action-button";

export function QuickActions() {
  const t = useTranslations("DashboardPage.quickActions");
  const { quickActions } = useDashboard();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="text-muted-foreground h-5 w-5" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
