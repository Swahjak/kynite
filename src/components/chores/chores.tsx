"use client";

import { useChores } from "./contexts/chores-context";
import { ProgressCard } from "./components/progress-card";
import { FilterTabs } from "./components/filter-tabs";
import { AllChoresView } from "./views/all-chores-view";
import { ByPersonView } from "./views/by-person-view";
import { UrgentView } from "./views/urgent-view";

interface ChoresProps {
  familyName: string;
}

export function Chores({ familyName }: ChoresProps) {
  const { currentView, isLoading } = useChores();

  // Get greeting based on time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold">
          {greeting}, {familyName}!
        </h1>
        <p className="text-muted-foreground">Let&apos;s crush today&apos;s goals.</p>
      </div>

      {/* Progress */}
      <ProgressCard />

      {/* Filters */}
      <FilterTabs />

      {/* Chore List */}
      <div className={isLoading ? "opacity-50 pointer-events-none" : ""}>
        {currentView === "all" && <AllChoresView />}
        {currentView === "by-person" && <ByPersonView />}
        {currentView === "urgent" && <UrgentView />}
      </div>
    </div>
  );
}
