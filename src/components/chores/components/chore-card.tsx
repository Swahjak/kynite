"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { IChoreWithAssignee } from "@/types/chore";
import {
  getUrgencyStatus,
  formatDueLabel,
  getUrgencyVariant,
} from "../helpers";
import { useChores } from "../contexts/chores-context";

interface ChoreCardProps {
  chore: IChoreWithAssignee;
}

export function ChoreCard({ chore }: ChoreCardProps) {
  const { completeChore } = useChores();
  const [isCompleting, setIsCompleting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const urgency = getUrgencyStatus(chore);
  const dueLabel = formatDueLabel(chore);
  const badgeVariant = getUrgencyVariant(urgency);

  const assignee = chore.assignedTo;
  const displayName = assignee?.displayName ?? assignee?.user.name ?? "Unassigned";
  const avatarColor = assignee?.avatarColor ?? "gray";

  const handleComplete = async () => {
    setIsCompleting(true);
    await completeChore(chore.id);
  };

  return (
    <div
      className={cn(
        "group relative flex items-center gap-4 rounded-xl border bg-card p-4 transition-all duration-200",
        isHovered && "border-primary shadow-sm",
        isCompleting && "animate-out slide-out-to-right fade-out duration-300"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar */}
      <Avatar className="h-14 w-14 ring-2 ring-offset-2" style={{ "--ring-color": avatarColor } as React.CSSProperties}>
        <AvatarImage src={assignee?.user.image ?? undefined} alt={displayName} />
        <AvatarFallback style={{ backgroundColor: avatarColor }} className="text-white font-medium">
          {displayName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-lg truncate">{chore.title}</h3>
        <div className="flex items-center gap-2 mt-1">
          {dueLabel && (
            <Badge variant={badgeVariant} className="text-xs font-bold uppercase">
              {dueLabel}
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">{displayName}</span>
        </div>
      </div>

      {/* Check Button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-12 w-12 rounded-full transition-all duration-200",
          "bg-muted hover:bg-primary hover:text-primary-foreground",
          "opacity-0 group-hover:opacity-100",
          isHovered && "opacity-100"
        )}
        onClick={handleComplete}
        disabled={isCompleting}
        aria-label={`Mark ${chore.title} as complete`}
      >
        <Check className="h-6 w-6" />
      </Button>
    </div>
  );
}
