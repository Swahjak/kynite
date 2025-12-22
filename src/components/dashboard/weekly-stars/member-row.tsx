"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FamilyMemberStar } from "../types";

interface MemberRowProps {
  member: FamilyMemberStar;
  rank: number;
}

const colorMap: Record<string, string> = {
  purple: "bg-purple-500",
  blue: "bg-blue-500",
  pink: "bg-pink-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  teal: "bg-teal-500",
};

export function MemberRow({ member, rank }: MemberRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg p-2",
        rank === 1 && "bg-primary/5"
      )}
    >
      <div
        className={cn(
          "rounded-full p-0.5",
          rank === 1 && "ring-primary ring-2"
        )}
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback
            className={cn(colorMap[member.avatarColor] || "bg-gray-500", "text-sm text-white")}
          >
            {member.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{member.name}</p>
        <p className="text-muted-foreground text-xs">
          Level {member.level} {member.levelTitle}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
        <span className="text-sm font-semibold tabular-nums">
          {member.weeklyStarCount}
        </span>
      </div>
    </div>
  );
}
