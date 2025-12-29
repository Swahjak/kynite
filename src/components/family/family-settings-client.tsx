// src/components/family/family-settings-client.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Family, FamilyMember } from "@/server/schema";
import type { FamilyMemberWithUser, FamilyMemberRole } from "@/types/family";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { FamilyMemberCard } from "./family-member-card";
import { InviteLinkGenerator } from "./invite-link-generator";
import { AddChildDialog } from "./add-child-dialog";
import { Pencil, Save, X, Loader2, UserPlus } from "lucide-react";

interface FamilySettingsClientProps {
  family: Family & { currentUserRole: FamilyMemberRole };
  members: FamilyMemberWithUser[];
  currentUserId: string;
  isManager: boolean;
  locale: string;
}

export function FamilySettingsClient({
  family,
  members: initialMembers,
  currentUserId,
  isManager,
  locale,
}: FamilySettingsClientProps) {
  const router = useRouter();
  const t = useTranslations("Family.dangerZone");
  const tDeletion = useTranslations("Deletion.family");
  const [members, setMembers] = useState(initialMembers);
  const [isEditingName, setIsEditingName] = useState(false);
  const [familyName, setFamilyName] = useState(family.name);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddChildOpen, setIsAddChildOpen] = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [pendingUpdateId, setPendingUpdateId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleSaveName() {
    if (!familyName.trim()) {
      toast.error("Family name cannot be empty");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/v1/families/${family.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: familyName }),
      });

      const result = await response.json();

      if (!result.success) {
        toast.error(result.error?.message || "Failed to update name");
        return;
      }

      toast.success("Family name updated");
      setIsEditingName(false);
      router.refresh();
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (pendingRemoveId || isLeaving) return;
    setPendingRemoveId(memberId);
    try {
      const response = await fetch(
        `/api/v1/families/${family.id}/members/${memberId}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!result.success) {
        toast.error(result.error?.message || "Failed to remove member");
        return;
      }

      setMembers(members.filter((m) => m.id !== memberId));
      toast.success("Member removed");
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setPendingRemoveId(null);
    }
  }

  async function handleLeaveFamily() {
    const currentMember = members.find((m) => m.userId === currentUserId);
    if (!currentMember || isLeaving) return;

    setIsLeaving(true);
    try {
      const response = await fetch(
        `/api/v1/families/${family.id}/members/${currentMember.id}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!result.success) {
        toast.error(result.error?.message || "Failed to leave family");
        return;
      }

      toast.success("You have left the family");
      router.push(`/${locale}/onboarding`);
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setIsLeaving(false);
    }
  }

  async function handleMemberUpdate(
    memberId: string,
    data: Partial<FamilyMember>
  ) {
    if (pendingUpdateId) return;
    setPendingUpdateId(memberId);
    try {
      const response = await fetch(
        `/api/v1/families/${family.id}/members/${memberId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

      const result = await response.json();

      if (!result.success) {
        toast.error(result.error?.message || "Failed to update member");
        return;
      }

      setMembers(
        members.map((m) =>
          m.id === memberId ? { ...m, ...result.data.member } : m
        )
      );
      toast.success("Member updated");
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setPendingUpdateId(null);
    }
  }

  function handleChildCreated() {
    router.refresh();
  }

  async function handleDeleteFamily() {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/v1/families/${family.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!result.success) {
        toast.error(result.error?.message || "Failed to delete family");
        return;
      }

      // Session will be invalid after deletion, use window.location instead of router
      window.location.href = "/";
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Family Details */}
      <Card>
        <CardHeader>
          <CardTitle>Family Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <>
                <Input
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  className="max-w-xs"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleSaveName}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setFamilyName(family.name);
                    setIsEditingName(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="text-lg font-medium">{family.name}</span>
                {isManager && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsEditingName(true)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            Created {new Date(family.createdAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Members ({members.length})</CardTitle>
            <CardDescription>Manage your family members</CardDescription>
          </div>
          {isManager && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddChildOpen(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add Child
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {members.map((member) => (
            <FamilyMemberCard
              key={member.id}
              member={member}
              familyId={family.id}
              isCurrentUser={member.userId === currentUserId}
              canEdit={isManager || member.userId === currentUserId}
              canRemove={isManager && member.userId !== currentUserId}
              canChangeRole={isManager}
              onUpdate={(data) => handleMemberUpdate(member.id, data)}
              onRemove={() => handleRemoveMember(member.id)}
              isRemoving={pendingRemoveId === member.id}
              isUpdating={pendingUpdateId === member.id}
            />
          ))}
        </CardContent>
      </Card>

      {/* Invite */}
      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle>Invite Members</CardTitle>
            <CardDescription>
              Generate a link to invite new members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteLinkGenerator familyId={family.id} />
          </CardContent>
        </Card>
      )}

      {/* Leave Family */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Family</CardTitle>
          <CardDescription>Remove yourself from this family</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isLeaving}>
                {isLeaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Leaving...
                  </>
                ) : (
                  "Leave Family"
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave Family?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to leave &ldquo;{family.name}&rdquo;?
                  You will need a new invite to rejoin.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isLeaving}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleLeaveFamily}
                  disabled={isLeaving}
                >
                  {isLeaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Leave
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Danger Zone - Managers only */}
      {isManager && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                t("deleteFamily")
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Delete Family Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={tDeletion("title")}
        description={tDeletion.rich("description", {
          name: family.name,
          count: members.length,
          bold: (chunks) => <strong>{chunks}</strong>,
        })}
        confirmText={family.name}
        onConfirm={handleDeleteFamily}
        isDeleting={isDeleting}
        confirmButtonText={tDeletion("confirm")}
      />

      {/* Add Child Dialog */}
      <AddChildDialog
        familyId={family.id}
        open={isAddChildOpen}
        onOpenChange={setIsAddChildOpen}
        onSuccess={handleChildCreated}
      />
    </div>
  );
}
