"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
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
import type { AvatarColor } from "@/types/family";
import type { IChoreWithAssignee } from "@/types/chore";
import { useChores } from "../contexts/chores-context";

interface TakeChoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chore: IChoreWithAssignee;
  onAssigned?: () => void;
}

export function TakeChoreDialog({
  open,
  onOpenChange,
  chore,
  onAssigned,
}: TakeChoreDialogProps) {
  const t = useTranslations("chores");
  const { members, updateChore } = useChores();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter out device members - only show human family members
  const humanMembers = members.filter((m) => m.role !== "device");

  const handleTake = async () => {
    if (!selectedMemberId) return;

    setIsSubmitting(true);
    try {
      await updateChore(chore.id, { assignedToId: selectedMemberId });
      toast.success(t("takeSuccess"));
      onOpenChange(false);
      onAssigned?.();
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
              {humanMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  <div className="flex items-center gap-2">
                    <FamilyAvatar
                      name={member.displayName ?? member.user.name}
                      color={member.avatarColor as AvatarColor}
                      avatarSvg={member.avatarSvg}
                      googleImage={member.user.image}
                      size="sm"
                    />
                    <span>{member.displayName ?? member.user.name}</span>
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
