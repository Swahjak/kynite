"use client";

import { useDashboard } from "../contexts/dashboard-context";
import { ActionButton } from "./action-button";

export function QuickActions() {
  const { quickActions } = useDashboard();

  if (quickActions.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {quickActions.map((action) => (
        <ActionButton key={action.id} action={action} />
      ))}
    </div>
  );
}
