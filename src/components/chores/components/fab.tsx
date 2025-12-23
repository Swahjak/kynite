"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FabProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function Fab({ onClick, disabled, className }: FabProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      size="icon"
      className={cn(
        "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg",
        "transition-transform hover:scale-105 active:scale-95",
        className
      )}
      aria-label="Add new chore"
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
