import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getAvatarColorClasses } from "@/lib/avatar-colors";
import type { AvatarColor } from "@/types/family";

interface FamilyAvatarProps {
  name: string;
  color?: AvatarColor | string | null;
  avatarSvg?: string | null;
  googleImage?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  showRing?: boolean;
}

export function FamilyAvatar({
  name,
  color,
  avatarSvg,
  googleImage,
  size = "md",
  className,
  showRing = true,
}: FamilyAvatarProps) {
  const sizeClasses = {
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-12 text-base",
  };

  const colorClasses = getAvatarColorClasses(color);

  const ringClasses = showRing
    ? cn("ring-2", colorClasses.ring, "ring-offset-2 ring-offset-background")
    : "";

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Priority 1: Custom SVG avatar
  if (avatarSvg) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-full [&>svg]:h-full [&>svg]:w-full",
          sizeClasses[size],
          ringClasses,
          className
        )}
        dangerouslySetInnerHTML={{ __html: avatarSvg }}
      />
    );
  }

  // Priority 2: Google profile image
  if (googleImage) {
    return (
      <Avatar className={cn(sizeClasses[size], ringClasses, className)}>
        <AvatarImage src={googleImage} alt={name} />
        <AvatarFallback
          className={cn("font-semibold", colorClasses.bg, colorClasses.text)}
        >
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
    );
  }

  // Priority 3: Initials with color
  return (
    <Avatar className={cn(sizeClasses[size], ringClasses, className)}>
      <AvatarFallback
        className={cn("font-semibold", colorClasses.bg, colorClasses.text)}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
