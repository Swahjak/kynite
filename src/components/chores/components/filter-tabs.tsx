"use client";

import { cn } from "@/lib/utils";
import { useChores } from "../contexts/chores-context";
import type { ChoreViewFilter } from "@/types/chore";

const FILTERS: { value: ChoreViewFilter; label: string }[] = [
  { value: "all", label: "All Chores" },
  { value: "urgent", label: "Urgent" },
];

export function FilterTabs() {
  const { currentView, setCurrentView } = useChores();

  return (
    <div className="bg-muted flex rounded-xl p-1">
      {FILTERS.map((filter) => (
        <button
          key={filter.value}
          onClick={() => setCurrentView(filter.value)}
          className={cn(
            "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            currentView === filter.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
