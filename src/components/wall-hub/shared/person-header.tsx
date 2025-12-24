"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { IUser } from "@/components/calendar/interfaces";

interface PersonHeaderProps {
  user: IUser;
}

export function PersonHeader({ user }: PersonHeaderProps) {
  return (
    <div className="bg-card border-border flex items-center gap-3 rounded-xl border p-3">
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
