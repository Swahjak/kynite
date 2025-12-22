"use client";

import { useState } from "react";
import {
  Trash2,
  Mail,
  Calendar,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import type { LinkedGoogleAccount } from "@/types/accounts";
import { CalendarSelectionSection } from "@/components/sync/calendar-selection-section";

interface LinkedGoogleAccountCardProps {
  account: LinkedGoogleAccount;
  familyId?: string;
  onUnlink: (accountId: string) => Promise<void>;
}

export function LinkedGoogleAccountCard({
  account,
  familyId,
  onUnlink,
}: LinkedGoogleAccountCardProps) {
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleUnlink = async () => {
    setIsUnlinking(true);
    try {
      await onUnlink(account.id);
      toast.success("Google account unlinked successfully");
    } catch (error) {
      toast.error("Failed to unlink account");
      console.error(error);
    } finally {
      setIsUnlinking(false);
    }
  };

  const hasCalendarScope = account.scopes.some((scope) =>
    scope.includes("calendar")
  );

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="rounded-lg border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="bg-muted flex size-10 items-center justify-center rounded-full">
              <Mail className="size-5" />
            </div>
            <div>
              <p className="font-medium">
                {account.email || account.googleAccountId}
              </p>
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                {hasCalendarScope && (
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    Calendar access
                  </span>
                )}
                <span>
                  Linked {new Date(account.linkedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {familyId && hasCalendarScope && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isExpanded ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" disabled={isUnlinking}>
                  {isUnlinking ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unlink Google Account</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove access to calendars from this Google
                    account. You can re-link it at any time.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleUnlink}>
                    Unlink Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {familyId && hasCalendarScope && (
          <CollapsibleContent>
            <div className="border-t px-4 py-3">
              <CalendarSelectionSection
                familyId={familyId}
                account={{
                  id: account.id,
                  googleAccountId: account.googleAccountId,
                }}
              />
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}
