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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="text-muted-foreground h-5 w-5" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {sortedMembers.map((member, index) => (
            <MemberRow key={member.id} member={member} rank={index + 1} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
