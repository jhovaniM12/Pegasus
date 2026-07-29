import { ApiService } from "@/services/api.service";
import type { ApiResponse } from "@/types/common";
import type { JudgingSystemSettings } from "@/types/system-settings";

class SystemSettingsService extends ApiService {
  async getJudgingSettings(): Promise<ApiResponse<JudgingSystemSettings>> {
    return this.get<ApiResponse<JudgingSystemSettings>>("/api/staff/system-settings/judging");
  }

  async updateJudgingSettings(
    payload: JudgingSystemSettings
  ): Promise<ApiResponse<JudgingSystemSettings>> {
    return this.patch<ApiResponse<JudgingSystemSettings>>(
      "/api/staff/system-settings/judging",
      payload
    );
  }
}

export const systemSettingsService = new SystemSettingsService();
