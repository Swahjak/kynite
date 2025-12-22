// src/components/family/invite-link-generator.tsx

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Loader2, RefreshCw } from "lucide-react";

interface InviteLinkGeneratorProps {
  familyId: string;
}

export function InviteLinkGenerator({ familyId }: InviteLinkGeneratorProps) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  async function generateInvite() {
    setIsGenerating(true);

    try {
      const response = await fetch(`/api/v1/families/${familyId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const result = await response.json();

      if (!result.success) {
        toast.error(result.error?.message || "Failed to generate invite");
        return;
      }

      setInviteUrl(result.data.url);
      toast.success("Invite link generated");
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyToClipboard() {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setIsCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy");
    }
  }

  if (!inviteUrl) {
    return (
      <Button onClick={generateInvite} disabled={isGenerating}>
        {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Generate Invite Link
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={inviteUrl} readOnly className="font-mono text-sm" />
        <Button onClick={copyToClipboard} variant="outline" size="icon">
          {isCopied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
        <Button
          onClick={generateInvite}
          variant="outline"
          size="icon"
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        Share this link with family members to invite them
      </p>
    </div>
  );
}
