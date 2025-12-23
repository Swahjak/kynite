"use client";

import { useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
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
import { useInteractionMode } from "@/components/calendar/contexts/interaction-mode-context";

interface ChoreCardProps {
  chore: IChoreWithAssignee;
  onEdit?: (chore: IChoreWithAssignee) => void;
  onDelete?: (chore: IChoreWithAssignee) => void;
}

export function ChoreCard({ chore, onEdit, onDelete }: ChoreCardProps) {
  const { completeChore, expandedChoreId, setExpandedChoreId } = useChores();
  const { canEdit } = useInteractionMode();
  const [isCompleting, setIsCompleting] = useState(false);

  const urgency = getUrgencyStatus(chore);
  const dueLabel = formatDueLabel(chore);
  const badgeVariant = getUrgencyVariant(urgency);

  const assignee = chore.assignedTo;
  const displayName = assignee?.displayName ?? assignee?.user.name ?? "Unassigned";
  const avatarColor = assignee?.avatarColor ?? "gray";

  const isExpanded = expandedChoreId === chore.id;

  const handleCardClick = () => {
    if (!canEdit) return;
    setExpandedChoreId(isExpanded ? null : chore.id);
  };

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCompleting(true);
    await completeChore(chore.id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(chore);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(chore);
  };

  return (
    <div
      role={canEdit ? "button" : undefined}
      tabIndex={canEdit ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (canEdit && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleCardClick();
        }
      }}
      className={cn(
        "group relative rounded-xl border bg-card transition-all duration-200",
        canEdit && "cursor-pointer",
        isExpanded && "border-primary shadow-sm",
        isCompleting && "animate-out slide-out-to-right fade-out duration-300"
      )}
    >
      {/* Main Content */}
      <div className="flex items-center gap-4 p-4">
        {/* Avatar */}
        <Avatar
          className="h-14 w-14 ring-2 ring-offset-2"
          style={{ "--ring-color": avatarColor } as React.CSSProperties}
        >
          <AvatarImage src={assignee?.user.image ?? undefined} alt={displayName} />
          <AvatarFallback
            style={{ backgroundColor: avatarColor }}
            className="text-white font-medium"
          >
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

        {/* Complete Button (hover reveal when not expanded) */}
        {!isExpanded && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-12 w-12 rounded-full transition-all duration-200",
              "bg-muted hover:bg-primary hover:text-primary-foreground",
              "opacity-0 group-hover:opacity-100"
            )}
            onClick={handleComplete}
            disabled={isCompleting}
            aria-label={`Mark ${chore.title} as complete`}
          >
            <Check className="h-6 w-6" />
          </Button>
        )}
      </div>

      {/* Expanded Actions */}
      {isExpanded && canEdit && (
        <div className="border-t px-4 py-3 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
          <Button size="sm" onClick={handleComplete} disabled={isCompleting}>
            <Check className="h-4 w-4 mr-1" />
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
