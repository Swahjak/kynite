"use client";

import { useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FamilyAvatar } from "@/components/family/family-avatar";
import type { AvatarColor } from "@/types/family";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { IChoreWithAssignee } from "@/types/chore";
import {
  getUrgencyStatus,
  formatDueLabel,
  getUrgencyVariant,
} from "../helpers";
import { useChores } from "../contexts/chores-context";
import { useIsManager } from "@/hooks/use-is-manager";

interface ChoreCardProps {
  chore: IChoreWithAssignee;
  onEdit?: (chore: IChoreWithAssignee) => void;
  onDelete?: (chore: IChoreWithAssignee) => void;
}

export function ChoreCard({ chore, onEdit, onDelete }: ChoreCardProps) {
  const { completeChore, expandedChoreId, setExpandedChoreId } = useChores();
  const canEdit = useIsManager();
  const [isCompleting, setIsCompleting] = useState(false);

  const urgency = getUrgencyStatus(chore);
  const dueLabel = formatDueLabel(chore);
  const badgeVariant = getUrgencyVariant(urgency);

  const assignee = chore.assignedTo;
  const displayName =
    assignee?.displayName ?? assignee?.user.name ?? "Unassigned";
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
        "group bg-card relative rounded-xl border transition-all duration-200",
        canEdit && "cursor-pointer",
        isExpanded && "border-primary shadow-sm",
        isCompleting && "animate-out slide-out-to-right fade-out duration-300"
      )}
    >
      {/* Main Content */}
      <div className="flex items-center gap-4 p-4">
        {/* Avatar */}
        <FamilyAvatar
          name={displayName}
          color={avatarColor as AvatarColor}
          avatarSvg={assignee?.avatarSvg}
          googleImage={assignee?.user.image}
          size="lg"
        />

        {/* Content */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold">{chore.title}</h3>
          <div className="mt-1 flex items-center gap-2">
            {dueLabel && (
              <Badge
                variant={badgeVariant}
                className="text-xs font-bold uppercase"
              >
                {dueLabel}
              </Badge>
            )}
            <span className="text-muted-foreground text-sm">{displayName}</span>
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
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Pencil className="mr-1 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-1 h-4 w-4" />
            Delete
          </Button>
          <Button size="sm" onClick={handleComplete} disabled={isCompleting}>
            <Check className="mr-1 h-4 w-4" />
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
