// src/components/family/member-edit-dialog.tsx

"use client";

import { useState } from "react";
import type {
  FamilyMemberWithUser,
  FamilyMemberRole,
  AvatarColor,
} from "@/types/family";
import { FAMILY_MEMBER_ROLES } from "@/types/family";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AvatarColorPicker } from "./avatar-color-picker";

interface MemberEditDialogProps {
  member: FamilyMemberWithUser;
  canChangeRole: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    displayName?: string | null;
    avatarColor?: AvatarColor | null;
    role?: FamilyMemberRole;
  }) => void;
}

const roleLabels: Record<FamilyMemberRole, string> = {
  manager: "Manager",
  participant: "Member",
  caregiver: "Caregiver",
  device: "Device",
  child: "Child",
};

export function MemberEditDialog({
  member,
  canChangeRole,
  open,
  onOpenChange,
  onSave,
}: MemberEditDialogProps) {
  const [displayName, setDisplayName] = useState(member.displayName || "");
  const [avatarColor, setAvatarColor] = useState<AvatarColor | null>(
    (member.avatarColor as AvatarColor) || null
  );
  const [role, setRole] = useState<FamilyMemberRole>(
    member.role as FamilyMemberRole
  );

  function handleSave() {
    onSave({
      displayName: displayName || null,
      avatarColor,
      ...(canChangeRole && { role }),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update display name and appearance
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={member.user.name}
            />
            <p className="text-muted-foreground text-xs">
              Leave empty to use account name
            </p>
          </div>

          <div className="space-y-2">
            <Label>Avatar Color</Label>
            <AvatarColorPicker value={avatarColor} onChange={setAvatarColor} />
          </div>

          {canChangeRole && (
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as FamilyMemberRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FAMILY_MEMBER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabels[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
