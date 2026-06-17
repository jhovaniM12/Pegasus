import { ApiService } from "@/services/api.service";
import type { ApiResponse } from "@/types/common";
import type {
  CreateJudgingReminderInput,
  JudgingReminder,
  UpdateJudgingReminderInput
} from "@/types/judging-reminders";

type ListJudgingRemindersFilters = {
  search?: string;
  isActive?: "true" | "false" | "all";
};

class JudgingRemindersService extends ApiService {
  async listJudgingReminders(
    filters?: ListJudgingRemindersFilters
  ): Promise<ApiResponse<JudgingReminder[]>> {
    const query = this.buildQuery({
      search: filters?.search,
      isActive: filters?.isActive
    });
    const suffix = query ? `?${query}` : "";
    return this.get<ApiResponse<JudgingReminder[]>>(`/api/judging-reminders${suffix}`);
  }

  async getJudgingReminder(id: string): Promise<ApiResponse<JudgingReminder>> {
    return this.get<ApiResponse<JudgingReminder>>(`/api/judging-reminders/${id}`);
  }

  async createJudgingReminder(
    payload: CreateJudgingReminderInput
  ): Promise<ApiResponse<JudgingReminder>> {
    return this.post<ApiResponse<JudgingReminder>>("/api/judging-reminders", payload);
  }

  async updateJudgingReminder(
    id: string,
    payload: UpdateJudgingReminderInput
  ): Promise<ApiResponse<JudgingReminder>> {
    return this.patch<ApiResponse<JudgingReminder>>(`/api/judging-reminders/${id}`, payload);
  }

  async deleteJudgingReminder(id: string): Promise<ApiResponse<{ id: string }>> {
    return this.delete<ApiResponse<{ id: string }>>(`/api/judging-reminders/${id}`);
  }
}

export const judgingRemindersService = new JudgingRemindersService();
