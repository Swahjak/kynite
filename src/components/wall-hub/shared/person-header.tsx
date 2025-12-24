"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { IUser } from "@/components/calendar/interfaces";
import { getUserColorById } from "./user-colors";

interface PersonHeaderProps {
  user: IUser;
  isHighlighted?: boolean;
}

export function PersonHeader({ user, isHighlighted }: PersonHeaderProps) {
  const color = getUserColorById(user.id);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3",
        isHighlighted
          ? `border-2 ${color.border} ${color.bg}`
          : "bg-card border-border"
      )}
    >
      <Avatar className="size-10">
        <AvatarImage src={user.avatarUrl} alt={user.name} />
        <AvatarFallback style={{ backgroundColor: user.avatarColor }}>
          {user.avatarFallback}
        </AvatarFallback>
      </Avatar>
      <span className="text-lg font-semibold">{user.name}</span>
    </div>
  );
}
