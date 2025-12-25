// src/components/family/add-child-dialog.tsx

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AVATAR_COLORS, type AvatarColor } from "@/types/family";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface AddChildDialogProps {
  familyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const colorClassMap: Record<AvatarColor, string> = {
  blue: "bg-[var(--event-blue-border)]",
  purple: "bg-[var(--event-purple-border)]",
  orange: "bg-[var(--event-orange-border)]",
  green: "bg-[var(--event-green-border)]",
  red: "bg-[var(--event-red-border)]",
  yellow: "bg-[var(--event-yellow-border)]",
  pink: "bg-[var(--event-pink-border)]",
  teal: "bg-[var(--event-teal-border)]",
};

export function AddChildDialog({
  familyId,
  open,
  onOpenChange,
  onSuccess,
}: AddChildDialogProps) {
  const t = useTranslations("Family");
  const tCommon = useTranslations("Common");
  const [name, setName] = useState("");
  const [avatarColor, setAvatarColor] = useState<AvatarColor>("blue");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/families/${familyId}/children`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatarColor }),
      });

      const data = await res.json();

      if (data.success) {
        setName("");
        setAvatarColor("blue");
        onOpenChange(false);
        onSuccess();
      } else {
        setError(data.error?.message || "Failed to add child");
      }
    } catch {
      setError("Failed to add child");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("addChild")}</DialogTitle>
            <DialogDescription>{t("childNamePlaceholder")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("childName")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("childNamePlaceholder")}
                maxLength={50}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>{t("selectAvatarColor")}</Label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAvatarColor(color)}
                    className={cn(
                      "size-10 rounded-full transition-all hover:scale-110",
                      colorClassMap[color],
                      avatarColor === color &&
                        "ring-ring ring-offset-background ring-2 ring-offset-2"
                    )}
                    aria-label={`Select ${color} color`}
                    aria-pressed={avatarColor === color}
                  />
                ))}
              </div>
            </div>

            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {tCommon("loading")}
                </>
              ) : (
                t("createChild")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
