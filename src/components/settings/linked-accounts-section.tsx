"use client";

import { Loader2 } from "lucide-react";
import { LinkedGoogleAccountCard } from "./linked-google-account-card";
import { LinkGoogleAccountButton } from "./link-google-account-button";
import { useLinkedAccounts, useUnlinkAccount } from "@/hooks/use-settings";

interface LinkedAccountsSectionProps {
  familyId?: string;
}

export function LinkedAccountsSection({
  familyId,
}: LinkedAccountsSectionProps = {}) {
  const { data: accounts = [], isLoading, error } = useLinkedAccounts();
  const unlinkMutation = useUnlinkAccount();

  const handleUnlink = async (accountId: string) => {
    await unlinkMutation.mutateAsync(accountId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-lg border p-4">
        {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {accounts.map((account) => (
          <LinkedGoogleAccountCard
            key={account.id}
            account={account}
            familyId={familyId}
            onUnlink={handleUnlink}
          />
        ))}
        {accounts.length === 0 && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No Google accounts linked yet
          </p>
        )}
      </div>

      <LinkGoogleAccountButton />
    </div>
  );
}
