"use client";

import { useState, type ReactNode } from "react";
import { NavigationProgressProvider } from "@/components/providers/navigation-progress-provider";
import { AppHeader } from "./app-header";
import { NavigationMenu } from "./navigation-menu";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <NavigationProgressProvider>
      <div className="bg-background flex min-h-screen flex-col">
        <AppHeader onMenuToggle={() => setMenuOpen(true)} />
        <div className="flex min-h-0 flex-1">
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
        <NavigationMenu open={menuOpen} onOpenChange={setMenuOpen} />
      </div>
    </NavigationProgressProvider>
  );
}
