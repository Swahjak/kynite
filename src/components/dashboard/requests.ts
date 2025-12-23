import type { DashboardData } from "./types";
import { MOCK_DASHBOARD_DATA } from "./mocks";
import { getUserFamily } from "@/server/services/family-service";

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const family = await getUserFamily(userId);

  if (!family) {
    // User has no family - return empty dashboard
    return {
      familyName: "",
      todaysEvents: [],
      activeTimers: [],
      familyMembers: [],
      quickActions: [],
    };
  }

  return {
    familyName: family.name,
    todaysEvents: MOCK_DASHBOARD_DATA.todaysEvents,
    activeTimers: MOCK_DASHBOARD_DATA.activeTimers,
    familyMembers: MOCK_DASHBOARD_DATA.familyMembers,
    quickActions: MOCK_DASHBOARD_DATA.quickActions,
  };
}
