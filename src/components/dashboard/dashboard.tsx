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
      <div className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <GreetingClock />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-5 lg:gap-8">
            <div className="md:col-span-3">
              <TodaysFlow />
            </div>

            <div className="space-y-4 md:col-span-2 md:space-y-5">
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
