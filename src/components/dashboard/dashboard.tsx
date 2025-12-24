import type { DashboardData } from "./types";
import { DashboardProvider } from "./contexts/dashboard-context";
import { GreetingClock } from "./greeting-clock/greeting-clock";
import { TodaysFlow } from "./todays-flow/todays-flow";
import { TodaysChores } from "./todays-chores/todays-chores";
import { ActiveTimers } from "./active-timers/active-timers";
import { WeeklyStars } from "./weekly-stars/weekly-stars";
import { QuickActionsFab } from "./quick-actions/quick-actions-fab";

interface DashboardProps {
  initialData: DashboardData;
}

export function Dashboard({ initialData }: DashboardProps) {
  return (
    <DashboardProvider data={initialData}>
      <div className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <GreetingClock />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-5 lg:gap-8">
            <div className="space-y-6 md:col-span-3">
              <TodaysFlow />
              <TodaysChores />
            </div>

            <div className="space-y-4 md:col-span-2 md:space-y-5">
              <ActiveTimers />
              <WeeklyStars />
            </div>
          </div>
        </div>
      </div>
      <QuickActionsFab />
    </DashboardProvider>
  );
}
