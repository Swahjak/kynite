"use client";

import { useState, type ReactNode } from "react";
import { NavigationProgressProvider } from "@/components/providers/navigation-progress-provider";
import { AppHeader } from "./app-header";
import { MobileNavigation } from "./mobile-navigation";
import { DesktopSidebar } from "./desktop-sidebar";
import { SidebarProvider } from "./sidebar-context";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <NavigationProgressProvider>
      <SidebarProvider>
        <div className="bg-background flex min-h-screen flex-col md:flex-row">
          {/* Desktop: persistent sidebar */}
          <DesktopSidebar />

          <div className="flex min-h-0 flex-1 flex-col">
            <AppHeader onMenuToggle={() => setMobileMenuOpen(true)} />
            <main className="flex-1 overflow-hidden">{children}</main>
          </div>

          {/* Mobile: slide-out drawer */}
          <div className="md:hidden">
            <MobileNavigation
              open={mobileMenuOpen}
              onOpenChange={setMobileMenuOpen}
            />
          </div>
        </div>
      </SidebarProvider>
    </NavigationProgressProvider>
  );
}
