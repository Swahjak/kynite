"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Copy, Check, Loader2, ArrowRight } from "lucide-react";

interface InviteMembersStepProps {
  familyId: string;
  locale: string;
}

export function InviteMembersStep({
  familyId,
  locale,
}: InviteMembersStepProps) {
  const router = useRouter();
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

  function continueToCalendar() {
    router.push(`/${locale}/onboarding/complete`);
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Invite Family Members</CardTitle>
        <CardDescription>
          Share an invite link with your family (you can skip this step)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!inviteUrl ? (
          <Button
            onClick={generateInvite}
            disabled={isGenerating}
            className="w-full"
            variant="outline"
          >
            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Invite Link
          </Button>
        ) : (
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
            </div>
            <p className="text-muted-foreground text-sm">
              Share this link with family members to invite them
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button onClick={continueToCalendar} className="w-full">
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        {!inviteUrl && (
          <Button
            onClick={continueToCalendar}
            variant="ghost"
            className="w-full"
          >
            Skip for now
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
