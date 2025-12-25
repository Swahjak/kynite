// src/components/family/upgrade-token-dialog.tsx

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Copy, Check } from "lucide-react";

interface UpgradeTokenDialogProps {
  familyId: string;
  childMemberId: string;
  childName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeTokenDialog({
  familyId,
  childMemberId,
  childName,
  open,
  onOpenChange,
}: UpgradeTokenDialogProps) {
  const t = useTranslations("Family");
  const [isGenerating, setIsGenerating] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/v1/families/${familyId}/children/${childMemberId}/upgrade-token`,
        { method: "POST" }
      );

      const data = await res.json();

      if (data.success) {
        const fullUrl = `${window.location.origin}${data.data.linkUrl}`;
        setLinkUrl(fullUrl);
        setExpiresAt(new Date(data.data.expiresAt).toLocaleString());
      } else {
        setError(data.error?.message || "Failed to generate link");
      }
    } catch {
      setError("Failed to generate link");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    if (linkUrl) {
      await navigator.clipboard.writeText(linkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleClose() {
    setLinkUrl(null);
    setExpiresAt(null);
    setCopied(false);
    setError(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("linkAccount")}</DialogTitle>
          <DialogDescription>
            Generate a link for {childName} to connect their account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!linkUrl ? (
            <>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  t("generateUpgradeLink")
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>{t("copyLink")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={linkUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="size-4 text-green-500" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              <p className="text-muted-foreground text-sm">
                {t("linkExpires")}: {expiresAt}
              </p>

              <p className="text-muted-foreground text-sm">
                Share this link with {childName}. When they click it and sign
                in, their account will be connected to their family profile.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
