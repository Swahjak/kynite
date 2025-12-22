import { Badge } from "@/components/ui/badge";
import type { FamilyMemberRole } from "@/types/family";

interface RoleBadgeProps {
  role: FamilyMemberRole;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const variantMap: Record<
    FamilyMemberRole,
    "default" | "secondary" | "outline"
  > = {
    manager: "default",
    participant: "secondary",
    caregiver: "outline",
  };

  const roleLabels: Record<FamilyMemberRole, string> = {
    manager: "Manager",
    participant: "Member",
    caregiver: "Caregiver",
  };

  return (
    <Badge variant={variantMap[role]} className={className}>
      {roleLabels[role]}
    </Badge>
  );
}
