"use client";

import { Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { IUser } from "@/components/calendar/interfaces";
import { getUserColorById } from "./user-colors";

interface PersonFilterChipsProps {
  users: IUser[];
  selectedUserId: string | "all";
  onSelect: (userId: string | "all") => void;
}

export function PersonFilterChips({
  users,
  selectedUserId,
  onSelect,
}: PersonFilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect("all")}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
          selectedUserId === "all"
            ? "bg-foreground text-background"
            : "bg-background hover:bg-muted border"
        )}
      >
        <Users className="size-4" />
        Everyone
      </button>
      {users.map((user) => {
        const color = getUserColorById(user.id);
        const isSelected = selectedUserId === user.id;
        return (
          <button
            key={user.id}
            onClick={() => onSelect(user.id)}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border-2 pr-4 pl-1.5 text-sm font-medium transition-colors",
              color.border,
              isSelected ? `${color.activeBg} text-white` : `${color.bg}`
            )}
          >
            <Avatar className="size-7">
              <AvatarImage src={user.avatarUrl} alt={user.name} />
              <AvatarFallback
                style={{ backgroundColor: user.avatarColor }}
                className="text-xs font-bold"
              >
                {user.avatarFallback}
              </AvatarFallback>
            </Avatar>
            {user.name}
          </button>
        );
      })}
    </div>
  );
}
