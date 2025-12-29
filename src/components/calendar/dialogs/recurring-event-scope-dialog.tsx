"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

interface RecurringEventScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "edit" | "delete";
  onSelectScope: (scope: "this" | "all") => void;
}

export function RecurringEventScopeDialog({
  open,
  onOpenChange,
  mode,
  onSelectScope,
}: RecurringEventScopeDialogProps) {
  const t = useTranslations("EventDialog");
  const tCommon = useTranslations("Common");

  const handleThis = () => {
    onSelectScope("this");
    onOpenChange(false);
  };

  const handleAll = () => {
    onSelectScope("all");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("recurringEventTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {mode === "edit"
              ? t("editRecurringDescription")
              : t("deleteRecurringDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleThis}
            className={buttonVariants({ variant: "outline" })}
          >
            {mode === "edit" ? t("editThisEvent") : t("deleteThisEvent")}
          </AlertDialogAction>
          <AlertDialogAction onClick={handleAll}>
            {mode === "edit" ? t("editAllEvents") : t("deleteAllEvents")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
