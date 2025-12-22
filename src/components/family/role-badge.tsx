import { Badge } from "@/components/ui/badge";
import type { FamilyMemberRole } from "@/types/family";

interface RoleBadgeProps {
  role: FamilyMemberRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const variantMap: Record<
    FamilyMemberRole,
    "default" | "secondary" | "outline"
  > = {
    manager: "default",
    participant: "secondary",
    caregiver: "outline",
  };

  return (
    <Badge variant={variantMap[role]}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </Badge>
  );
}
