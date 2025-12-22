import type { DashboardData } from "./types";
import { MOCK_DASHBOARD_DATA } from "./mocks";

export async function getDashboardData(): Promise<DashboardData> {
  // TODO: Replace with real data fetching
  return MOCK_DASHBOARD_DATA;
}
