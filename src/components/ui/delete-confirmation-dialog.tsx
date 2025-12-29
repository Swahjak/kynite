"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmText: string;
  onConfirm: () => void | Promise<void>;
  isDeleting?: boolean;
  confirmButtonText?: string;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  onConfirm,
  isDeleting = false,
  confirmButtonText = "Delete",
}: DeleteConfirmationDialogProps) {
  const [inputValue, setInputValue] = React.useState("");
  const isMatch = inputValue === confirmText;

  // Reset input when dialog closes
  React.useEffect(() => {
    if (!open) {
      setInputValue("");
    }
  }, [open]);

  async function handleConfirm() {
    if (!isMatch || isDeleting) return;
    await onConfirm();
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>{description}</p>
              <div className="space-y-2">
                <Label htmlFor="confirm-input">
                  Type <span className="font-semibold">"{confirmText}"</span> to
                  confirm
                </Label>
                <Input
                  id="confirm-input"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={`Type "${confirmText}" to confirm`}
                  disabled={isDeleting}
                  autoComplete="off"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isMatch || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              confirmButtonText
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
