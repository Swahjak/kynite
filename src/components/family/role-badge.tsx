"use client";

import { Badge } from "@/components/ui/badge";
import type { FamilyMemberRole } from "@/types/family";
import { useTranslations } from "next-intl";

interface RoleBadgeProps {
  role: FamilyMemberRole;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const t = useTranslations("Family.roles");

  const variantMap: Record<
    FamilyMemberRole,
    "default" | "secondary" | "outline"
  > = {
    manager: "default",
    participant: "secondary",
    caregiver: "outline",
    device: "outline",
    child: "secondary",
  };

  return (
    <Badge variant={variantMap[role]} className={className}>
      {t(role)}
    </Badge>
  );
}
