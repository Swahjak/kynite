// src/components/family/family-member-card.tsx

"use client";

import { useState } from "react";
import type {
  FamilyMemberWithUser,
  FamilyMemberRole,
  AvatarColor,
} from "@/types/family";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RoleBadge } from "./role-badge";
import { FamilyAvatar } from "./family-avatar";
import { MemberEditDialog } from "./member-edit-dialog";
import { UpgradeTokenDialog } from "./upgrade-token-dialog";
import { Pencil, Trash2, Link } from "lucide-react";

interface FamilyMemberCardProps {
  member: FamilyMemberWithUser;
  familyId: string;
  isCurrentUser: boolean;
  canEdit: boolean;
  canRemove: boolean;
  canChangeRole: boolean;
  onUpdate: (data: {
    displayName?: string | null;
    avatarColor?: AvatarColor | null;
    role?: FamilyMemberRole;
  }) => void;
  onRemove: () => void;
}

export function FamilyMemberCard({
  member,
  familyId,
  isCurrentUser,
  canEdit,
  canRemove,
  canChangeRole,
  onUpdate,
  onRemove,
}: FamilyMemberCardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);

  const isChildMember = member.role === "child";

  const displayName = member.displayName || member.user.name;

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <FamilyAvatar
          name={displayName}
          color={member.avatarColor as AvatarColor}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{displayName}</span>
            {isCurrentUser && (
              <span className="text-muted-foreground text-xs">(you)</span>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-muted-foreground truncate text-sm">
              {member.user.email}
            </span>
            <RoleBadge role={member.role as FamilyMemberRole} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {isChildMember && canChangeRole && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsUpgradeDialogOpen(true)}
            title="Generate account link"
          >
            <Link className="h-4 w-4" />
          </Button>
        )}

        {canEdit && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsEditDialogOpen(true)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}

        {canRemove && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost">
                <Trash2 className="text-destructive h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Member?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove {displayName} from the family?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onRemove}>Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <MemberEditDialog
        member={member}
        canChangeRole={canChangeRole}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSave={onUpdate}
      />

      {isChildMember && (
        <UpgradeTokenDialog
          familyId={familyId}
          childMemberId={member.id}
          childName={displayName}
          open={isUpgradeDialogOpen}
          onOpenChange={setIsUpgradeDialogOpen}
        />
      )}
    </div>
  );
}
