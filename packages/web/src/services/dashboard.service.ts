import { ApiService } from "@/services/api.service";
import type { ApiResponse } from "@/types/common";
import type { RootDashboardSummary } from "@/types/dashboard";

class DashboardService extends ApiService {
  async getSummary(): Promise<ApiResponse<RootDashboardSummary>> {
    return this.get<ApiResponse<RootDashboardSummary>>("/api/dashboard/summary");
  }
}

export const dashboardService = new DashboardService();
