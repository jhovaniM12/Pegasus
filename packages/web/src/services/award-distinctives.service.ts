import { ApiService } from "@/services/api.service";
import type { ApiResponse } from "@/types/common";
import type { AwardDistinctive } from "@/types/award-distinctives";

type UpdateAwardDistinctiveInput = {
  label?: string;
  colorName?: string;
  colorHex?: string | null;
  isActive?: boolean;
};

class AwardDistinctivesService extends ApiService {
  async listAwardDistinctives(): Promise<ApiResponse<AwardDistinctive[]>> {
    return this.get<ApiResponse<AwardDistinctive[]>>("/api/staff/award-distinctives");
  }

  async updateAwardDistinctive(
    id: string,
    payload: UpdateAwardDistinctiveInput
  ): Promise<ApiResponse<AwardDistinctive>> {
    return this.patch<ApiResponse<AwardDistinctive>>(`/api/staff/award-distinctives/${id}`, payload);
  }
}

export const awardDistinctivesService = new AwardDistinctivesService();
