"use client";

import { useState } from "react";
import { Check, Hand, Pencil, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { FamilyAvatar } from "@/components/family/family-avatar";
import type { AvatarColor } from "@/types/family";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { IChoreWithAssignee, UrgencyStatus } from "@/types/chore";
import {
  getUrgencyStatus,
  formatDueLabel,
  getUrgencyVariant,
} from "../helpers";
import { useChoresOptional } from "../contexts/chores-context";
import { useIsManager } from "@/hooks/use-is-manager";
import { useConfetti } from "@/components/confetti";
import { TakeChoreDialog } from "./take-chore-dialog";

/** Minimal chore data needed for display */
export interface ChoreCardData {
  id: string;
  title: string;
  assignedToId: string | null;
  starReward: number;
  /** Assignee display info */
  assignee?: {
    displayName: string;
    avatarColor: string;
    avatarSvg?: string | null;
    googleImage?: string | null;
  } | null;
}

interface ChoreCardProps {
  /** Full chore data from chores context, or minimal data for dashboard */
  chore: IChoreWithAssignee | ChoreCardData;
  /** Pre-calculated urgency status (used by dashboard, otherwise computed from chore) */
  urgency?: UrgencyStatus;
  /** Pre-calculated due label (used by dashboard, otherwise computed from chore) */
  dueLabel?: string | null;
  /** Called when chore is completed. Falls back to chores context if not provided. */
  onComplete?: (choreId: string) => Promise<void>;
  /** Called when take button is clicked. Opens TakeChoreDialog if not provided and context available. */
  onTake?: (chore: ChoreCardData) => void;
  /** Called when edit is requested (only shown in expanded view) */
  onEdit?: (chore: IChoreWithAssignee) => void;
  /** Called when delete is requested (only shown in expanded view) */
  onDelete?: (chore: IChoreWithAssignee) => void;
  /** Whether this card can be expanded for edit/delete actions */
  expandable?: boolean;
}

/** Type guard to check if chore is full IChoreWithAssignee */
function isFullChore(
  chore: IChoreWithAssignee | ChoreCardData
): chore is IChoreWithAssignee {
  return "status" in chore;
}

export function ChoreCard({
  chore,
  urgency: urgencyProp,
  dueLabel: dueLabelProp,
  onComplete: onCompleteProp,
  onTake: onTakeProp,
  onEdit,
  onDelete,
  expandable = true,
}: ChoreCardProps) {
  const t = useTranslations("chores");
  const choresContext = useChoresOptional();
  const canEdit = useIsManager();
  const [isCompleting, setIsCompleting] = useState(false);
  const [takeDialogOpen, setTakeDialogOpen] = useState(false);
  const { fire } = useConfetti();

  // Use prop callbacks or fall back to context
  const completeChore = onCompleteProp ?? choresContext?.completeChore;
  const expandedChoreId = expandable ? choresContext?.expandedChoreId : null;
  const setExpandedChoreId = expandable
    ? choresContext?.setExpandedChoreId
    : undefined;

  const isUnassigned = !chore.assignedToId;
  const canExpand =
    expandable && canEdit && setExpandedChoreId && isFullChore(chore);

  // Use provided urgency/label or compute from full chore data
  const urgency =
    urgencyProp ?? (isFullChore(chore) ? getUrgencyStatus(chore) : "none");
  const dueLabel =
    dueLabelProp !== undefined
      ? dueLabelProp
      : isFullChore(chore)
        ? formatDueLabel(chore)
        : null;
  const badgeVariant = getUrgencyVariant(urgency);

  // Get display name and avatar - handle both full and minimal chore types
  const assignee = isFullChore(chore) ? chore.assignedTo : chore.assignee;
  const displayName = isFullChore(chore)
    ? (assignee?.displayName ??
      (assignee as IChoreWithAssignee["assignedTo"])?.user.name ??
      "Unassigned")
    : (assignee?.displayName ?? "Unassigned");
  const avatarColor = assignee?.avatarColor ?? "gray";
  const avatarSvg = isFullChore(chore)
    ? chore.assignedTo?.avatarSvg
    : chore.assignee?.avatarSvg;
  const googleImage = isFullChore(chore)
    ? chore.assignedTo?.user.image
    : chore.assignee?.googleImage;

  const isExpanded = canExpand && expandedChoreId === chore.id;

  const handleCardClick = () => {
    if (!canExpand) return;
    setExpandedChoreId?.(isExpanded ? null : chore.id);
  };

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!completeChore) return;
    setIsCompleting(true);
    await completeChore(chore.id);
    fire(chore.starReward);
  };

  const handleTake = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTakeProp) {
      onTakeProp(chore);
    } else {
      setTakeDialogOpen(true);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFullChore(chore)) {
      onEdit?.(chore);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFullChore(chore)) {
      onDelete?.(chore);
    }
  };

  // Determine if we can show the take dialog (need chores context and full chore)
  const canShowTakeDialog = !onTakeProp && choresContext && isFullChore(chore);

  return (
    <div
      role={canExpand ? "button" : undefined}
      tabIndex={canExpand ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (canExpand && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleCardClick();
        }
      }}
      className={cn(
        "group bg-card relative rounded-xl border transition-all duration-200",
        canExpand && "cursor-pointer",
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
          avatarSvg={avatarSvg}
          googleImage={googleImage}
          size="lg"
        />

        {/* Content */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold">{chore.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
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

        {/* Star reward */}
        <div className="flex items-center gap-1 text-amber-500">
          <Star className="h-4 w-4 fill-current" />
          <span className="text-sm font-medium">{chore.starReward}</span>
        </div>

        {/* Action Button (always visible for touch devices) */}
        {!isExpanded &&
          (isUnassigned ? (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-12 w-12 shrink-0 rounded-full transition-colors",
                "bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white active:bg-amber-600"
              )}
              onClick={handleTake}
              aria-label={t("takeChore", { title: chore.title })}
            >
              <Hand className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-12 w-12 shrink-0 rounded-full transition-colors",
                "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground active:bg-primary/90"
              )}
              onClick={handleComplete}
              disabled={isCompleting || !completeChore}
              aria-label={`Mark ${chore.title} as complete`}
            >
              <Check className="h-5 w-5" />
            </Button>
          ))}
      </div>

      {/* Expanded Actions */}
      {isExpanded && canEdit && (
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Pencil className="mr-1 h-4 w-4" />
            {t("edit")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete}>
            <Trash2 className="mr-1 h-4 w-4" />
            {t("delete")}
          </Button>
          {isUnassigned ? (
            <Button size="sm" onClick={handleTake}>
              <Hand className="mr-1 h-4 w-4" />
              {t("take")}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleComplete}
              disabled={isCompleting || !completeChore}
            >
              <Check className="mr-1 h-4 w-4" />
              {t("done")}
            </Button>
          )}
        </div>
      )}

      {/* Take Chore Dialog - only shown when using context with full chore data */}
      {canShowTakeDialog && isFullChore(chore) && (
        <TakeChoreDialog
          open={takeDialogOpen}
          onOpenChange={setTakeDialogOpen}
          chore={chore}
        />
      )}
    </div>
  );
}
