import { getDashboardData } from "./requests";
import { DashboardProvider } from "./contexts/dashboard-context";
import { GreetingClock } from "./greeting-clock/greeting-clock";
import { TodaysFlow } from "./todays-flow/todays-flow";
import { ActiveTimers } from "./active-timers/active-timers";
import { WeeklyStars } from "./weekly-stars/weekly-stars";
import { QuickActions } from "./quick-actions/quick-actions";

export async function Dashboard() {
  const data = await getDashboardData();

  return (
    <DashboardProvider data={data}>
      <div className="flex-1 p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <GreetingClock />

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <TodaysFlow />
            </div>

            <div className="space-y-6">
              <ActiveTimers />
              <WeeklyStars />
              <QuickActions />
            </div>
          </div>
        </div>
      </div>
    </DashboardProvider>
  );
}
