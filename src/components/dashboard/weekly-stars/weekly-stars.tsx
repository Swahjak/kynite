"use client";

import { useTranslations } from "next-intl";
import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "../contexts/dashboard-context";
import { MemberRow } from "./member-row";

export function WeeklyStars() {
  const t = useTranslations("DashboardPage.weeklyStars");
  const { familyMembers } = useDashboard();

  const sortedMembers = [...familyMembers].sort(
    (a, b) => b.weeklyStarCount - a.weeklyStarCount
  );

  return (
    <div className="space-y-2">
      <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {t("title")}
      </h3>
      <div className="space-y-1">
        {sortedMembers.map((member, index) => (
          <MemberRow key={member.id} member={member} rank={index + 1} />
        ))}
      </div>
    </div>
  );
}
