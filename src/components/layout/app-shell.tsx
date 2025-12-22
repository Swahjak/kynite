"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { AppHeader } from "./app-header";
import { NavigationMenu } from "./navigation-menu";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "family-planner:sidebar-expanded";

interface AppShellProps {
  children: ReactNode;
  isManager: boolean;
  onAddEvent?: () => void;
}

export function AppShell({ children, isManager, onAddEvent }: AppShellProps) {
  const { mode } = useInteractionMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  // Auto-collapse sidebar in wall mode, restore preference in manage mode
  useEffect(() => {
    if (mode === "wall") {
      setSidebarExpanded(false);
    } else {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      setSidebarExpanded(stored !== "false");
    }
  }, [mode]);

  const handleSidebarToggle = () => {
    const newValue = !sidebarExpanded;
    setSidebarExpanded(newValue);
    if (mode === "manage") {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(newValue));
    }
  };

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AppHeader
        onAddEvent={onAddEvent}
        isManager={isManager}
        onMenuToggle={() => setMenuOpen(true)}
      />
      <div className="flex flex-1">
        <main
          className={cn(
            "flex-1 transition-all duration-200",
            sidebarExpanded && mode === "manage" ? "lg:ml-64" : ""
          )}
        >
          {children}
        </main>
      </div>
      <NavigationMenu open={menuOpen} onOpenChange={setMenuOpen} />
    </div>
  );
}
