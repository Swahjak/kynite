"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { FamilyAvatar } from "@/components/family/family-avatar";
import type { FamilyMemberStar } from "../types";

interface MemberRowProps {
  member: FamilyMemberStar;
  rank: number;
}

export function MemberRow({ member, rank }: MemberRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg p-2",
        rank === 1 && "bg-primary/5"
      )}
    >
      <FamilyAvatar name={member.name} color={member.avatarColor} size="sm" />

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
