"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface SidebarContextValue {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  toggle: () => void;
  collapse: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Always starts collapsed per requirements (no persistence)
  const [isCollapsed, setIsCollapsed] = useState(true);

  const toggle = () => setIsCollapsed((prev) => !prev);
  const collapse = () => setIsCollapsed(true);

  return (
    <SidebarContext.Provider
      value={{ isCollapsed, setIsCollapsed, toggle, collapse }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
