// src/components/family/member-edit-dialog.tsx

"use client";

import { useState, useRef } from "react";
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
import { FamilyAvatar } from "./family-avatar";
import { Upload, Trash2, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

interface MemberEditDialogProps {
  member: FamilyMemberWithUser;
  canChangeRole: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    displayName?: string | null;
    avatarColor?: AvatarColor | null;
    avatarSvg?: string | null;
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

const MAX_FILE_SIZE = 10 * 1024; // 10KB

export function MemberEditDialog({
  member,
  canChangeRole,
  open,
  onOpenChange,
  onSave,
}: MemberEditDialogProps) {
  const t = useTranslations("Family.avatar");
  const [displayName, setDisplayName] = useState(member.displayName || "");
  const [avatarColor, setAvatarColor] = useState<AvatarColor | null>(
    (member.avatarColor as AvatarColor) || null
  );
  const [avatarSvg, setAvatarSvg] = useState<string | null>(
    member.avatarSvg || null
  );
  const [role, setRole] = useState<FamilyMemberRole>(
    member.role as FamilyMemberRole
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentDisplayName = displayName || member.user.name;

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(t("fileTooLarge"));
      return;
    }

    // Validate file type
    if (!file.name.endsWith(".svg") && file.type !== "image/svg+xml") {
      setUploadError(t("invalidFormat"));
      return;
    }

    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content && content.trim().startsWith("<svg")) {
        setAvatarSvg(content);
      } else {
        setUploadError(t("invalidFormat"));
      }
    };
    reader.readAsText(file);
  }

  function handleRemoveAvatar() {
    setAvatarSvg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleSave() {
    onSave({
      displayName: displayName || null,
      avatarColor,
      avatarSvg,
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
          {/* Avatar Preview */}
          <div className="flex flex-col items-center gap-3">
            <FamilyAvatar
              name={currentDisplayName}
              color={avatarColor}
              avatarSvg={avatarSvg}
              googleImage={member.user.image}
              size="lg"
            />
          </div>

          {/* Avatar Upload */}
          <div className="space-y-2">
            <Label>{t("upload")}</Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".svg,image/svg+xml"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {t("upload")}
              </Button>
              {avatarSvg && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveAvatar}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("remove")}
                </Button>
              )}
            </div>
            <a
              href="https://getavataaars.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
            >
              <ExternalLink className="h-3 w-3" />
              {t("createAt")}
            </a>
            {uploadError && (
              <p className="text-destructive text-xs">{uploadError}</p>
            )}
          </div>

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
            <p className="text-muted-foreground text-xs">
              Used when no custom avatar is set
            </p>
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
