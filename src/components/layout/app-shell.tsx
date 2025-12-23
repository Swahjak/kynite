"use client";

import { useState, type ReactNode } from "react";
import { useAddEventSafe } from "@/contexts/add-event-context";
import { AppHeader } from "./app-header";
import { NavigationMenu } from "./navigation-menu";

interface AppShellProps {
  children: ReactNode;
  isManager: boolean;
  onAddEvent?: () => void;
}

export function AppShell({ children, isManager }: AppShellProps) {
  const addEventContext = useAddEventSafe();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleAddEvent = () => {
    addEventContext?.addEventButtonRef.current?.click();
  };

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AppHeader
        onAddEvent={handleAddEvent}
        isManager={isManager}
        onMenuToggle={() => setMenuOpen(true)}
      />
      <div className="flex flex-1">
        <main className="flex-1">{children}</main>
      </div>
      <NavigationMenu open={menuOpen} onOpenChange={setMenuOpen} />
    </div>
  );
}
