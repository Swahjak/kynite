"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import authClient from "@/lib/auth-client";
import { toast } from "sonner";

interface LinkGoogleAccountButtonProps {
  onSuccess?: () => void;
}

export function LinkGoogleAccountButton({
  onSuccess,
}: LinkGoogleAccountButtonProps) {
  const [isLinking, setIsLinking] = useState(false);

  const handleLinkGoogle = async () => {
    setIsLinking(true);
    try {
      // Use Better-Auth's social linking
      await authClient.linkSocial({
        provider: "google",
        callbackURL: "/settings/accounts",
      });
      // User will be redirected to Google OAuth
      // onSuccess called after redirect back
      onSuccess?.();
    } catch (error) {
      setIsLinking(false);
      toast.error("Failed to initiate Google account linking");
      console.error(error);
    }
  };

  return (
    <Button
      onClick={handleLinkGoogle}
      disabled={isLinking}
      variant="outline"
      className="w-full"
    >
      {isLinking ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <Plus className="mr-2 size-4" />
      )}
      Link Google Account
    </Button>
  );
}
