"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/responsive-modal";
import { FamilyAvatar } from "@/components/family/family-avatar";
import {
  ChoreCard,
  type ChoreCardData,
} from "@/components/chores/components/chore-card";
import { useDashboard } from "../contexts/dashboard-context";
import type { DashboardChore, ChoreUrgency } from "../types";
import type { UrgencyStatus } from "@/types/chore";
import type { AvatarColor } from "@/types/family";

/** Map DashboardChore urgency to UrgencyStatus for ChoreCard */
function mapUrgency(urgency: ChoreUrgency): UrgencyStatus {
  return urgency as UrgencyStatus;
}

/** Format due time for display label */
function formatDueLabel(
  chore: DashboardChore,
  t: ReturnType<typeof useTranslations>
): string | null {
  if (chore.urgency === "overdue") return t("overdue");
  if (chore.urgency === "urgent") return t("urgentBadge");
  if (chore.urgency === "due-soon") return t("dueSoonBadge");

  if (chore.dueTime) {
    const [hours, minutes] = chore.dueTime.split(":");
    const hour = parseInt(hours, 10);
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${t("today")} • ${displayHour}:${minutes} ${period}`;
  }

  return null;
}

/** Convert DashboardChore to ChoreCardData */
function toChoreCardData(chore: DashboardChore): ChoreCardData {
  return {
    id: chore.id,
    title: chore.title,
    assignedToId: chore.assignee ? chore.id : null, // Use chore id as marker if assigned
    starReward: chore.starReward,
    assignee: chore.assignee
      ? {
          displayName: chore.assignee.name,
          avatarColor: chore.assignee.avatarColor,
        }
      : null,
  };
}

/** Take chore dialog for dashboard (uses familyMembers from dashboard context) */
interface TakeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chore: DashboardChore | null;
}

function TakeChoreDialogDashboard({
  open,
  onOpenChange,
  chore,
}: TakeDialogProps) {
  const t = useTranslations("chores");
  const { familyMembers, assignChore } = useDashboard();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTake = async () => {
    if (!selectedMemberId || !chore) return;

    setIsSubmitting(true);
    try {
      await assignChore(chore.id, selectedMemberId);
      toast.success(t("takeSuccess"));
      onOpenChange(false);
      setSelectedMemberId(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to assign chore";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>{t("takeTitle")}</ModalTitle>
          <ModalDescription>{t("takeDescription")}</ModalDescription>
        </ModalHeader>

        <div className="py-4">
          <Select
            value={selectedMemberId ?? ""}
            onValueChange={setSelectedMemberId}
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("selectPerson")} />
            </SelectTrigger>
            <SelectContent>
              {familyMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  <div className="flex items-center gap-2">
                    <FamilyAvatar
                      name={member.name}
                      color={member.avatarColor as AvatarColor}
                      size="sm"
                    />
                    <span>{member.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ModalFooter>
          <ModalClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              {t("cancel")}
            </Button>
          </ModalClose>
          <Button
            onClick={handleTake}
            disabled={isSubmitting || !selectedMemberId}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("takeButton")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function TodaysChores() {
  const t = useTranslations("DashboardPage.todaysChores");
  const { todaysChores, choresRemaining, completeChore } = useDashboard();

  // Take dialog state
  const [takeDialogOpen, setTakeDialogOpen] = useState(false);
  const [choreToTake, setChoreToTake] = useState<DashboardChore | null>(null);

  const handleTake = useCallback(
    (chore: ChoreCardData) => {
      const dashboardChore = todaysChores.find((c) => c.id === chore.id);
      if (dashboardChore) {
        setChoreToTake(dashboardChore);
        setTakeDialogOpen(true);
      }
    },
    [todaysChores]
  );

  // Group chores by urgency
  const urgentChores = todaysChores.filter(
    (c) => c.urgency === "overdue" || c.urgency === "urgent"
  );
  const dueSoonChores = todaysChores.filter((c) => c.urgency === "due-soon");
  const regularChores = todaysChores.filter((c) => c.urgency === "none");

  const renderChoreCard = (chore: DashboardChore) => (
    <ChoreCard
      key={chore.id}
      chore={toChoreCardData(chore)}
      urgency={mapUrgency(chore.urgency)}
      dueLabel={formatDueLabel(chore, t)}
      onComplete={completeChore}
      onTake={handleTake}
      expandable={false}
    />
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="text-muted-foreground h-5 w-5" />
          <h2 className="text-lg font-semibold">{t("title")}</h2>
        </div>
        <Badge variant="secondary">
          {t("choresRemaining", { count: choresRemaining })}
        </Badge>
      </div>

      <div className="space-y-3">
        {urgentChores.length > 0 && (
          <div>
            <p className="text-destructive mb-1 text-xs font-medium tracking-wide uppercase">
              {t("urgent")}
            </p>
            <div className="space-y-2">{urgentChores.map(renderChoreCard)}</div>
          </div>
        )}

        {dueSoonChores.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
              {t("dueSoon")}
            </p>
            <div className="space-y-2">
              {dueSoonChores.map(renderChoreCard)}
            </div>
          </div>
        )}

        {regularChores.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
              {t("today")}
            </p>
            <div className="space-y-2">
              {regularChores.map(renderChoreCard)}
            </div>
          </div>
        )}

        {todaysChores.length === 0 && (
          <p className="text-muted-foreground py-8 text-center">
            {t("noChores")}
          </p>
        )}
      </div>

      {/* Take Chore Dialog */}
      <TakeChoreDialogDashboard
        open={takeDialogOpen}
        onOpenChange={setTakeDialogOpen}
        chore={choreToTake}
      />
    </section>
  );
}
