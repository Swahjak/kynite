"use client";

import { useDashboard } from "../contexts/dashboard-context";
import { ActionButton } from "./action-button";

export function QuickActions() {
  const { quickActions } = useDashboard();

  return (
    <div className="grid grid-cols-2 gap-2">
      {quickActions.map((action) => (
        <ActionButton key={action.id} action={action} />
      ))}
    </div>
  );
}
