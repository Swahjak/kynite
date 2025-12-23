import type { DashboardData } from "./types";
import { MOCK_DASHBOARD_DATA } from "./mocks";

export async function getDashboardData(userId: string): Promise<DashboardData> {
  // TODO: Replace with real data fetching
  console.log("Fetching dashboard data for user:", userId);
  return MOCK_DASHBOARD_DATA;
}
