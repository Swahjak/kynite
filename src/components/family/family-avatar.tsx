import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { AvatarColor } from "@/types/family";

interface FamilyAvatarProps {
  name: string;
  color?: AvatarColor | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function FamilyAvatar({
  name,
  color,
  size = "md",
  className,
}: FamilyAvatarProps) {
  const sizeClasses = {
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-12 text-base",
  };

  const colorClassMap: Record<AvatarColor, string> = {
    blue: "bg-[var(--event-blue-border)] text-white",
    purple: "bg-[var(--event-purple-border)] text-white",
    orange: "bg-[var(--event-orange-border)] text-white",
    green: "bg-[var(--event-green-border)] text-white",
    red: "bg-[var(--event-red-border)] text-white",
    yellow: "bg-[var(--event-yellow-border)] text-white",
    pink: "bg-[var(--event-pink-border)] text-white",
    teal: "bg-[var(--event-teal-border)] text-white",
  };

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarFallback
        className={cn(
          "font-semibold",
          color ? colorClassMap[color] : "bg-muted text-muted-foreground"
        )}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
