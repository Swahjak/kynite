"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { LinkedGoogleAccountCard } from "./linked-google-account-card";
import { LinkGoogleAccountButton } from "./link-google-account-button";
import type { LinkedGoogleAccount } from "@/types/accounts";

interface LinkedAccountsSectionProps {
  familyId?: string;
}

export function LinkedAccountsSection({
  familyId,
}: LinkedAccountsSectionProps = {}) {
  const [accounts, setAccounts] = useState<LinkedGoogleAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/accounts/linked");
      const data = await response.json();

      if (data.success) {
        setAccounts(data.data.accounts);
        setError(null);
      } else {
        setError(data.error?.message || "Failed to load accounts");
      }
    } catch (err) {
      setError("Failed to load linked accounts");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleUnlink = async (accountId: string) => {
    const response = await fetch(`/api/v1/accounts/linked/${accountId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || "Failed to unlink");
    }

    const data = await response.json();
    if (data.success) {
      setAccounts((prev) => prev.filter((acc) => acc.id !== accountId));
    } else {
      throw new Error(data.error?.message || "Failed to unlink");
    }
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
        {error}
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
