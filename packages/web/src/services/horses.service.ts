import { ApiService } from "@/services/api.service";
import type { PaginatedResponse } from "@/types/common";
import type { Horse } from "@/types/horses";

type HorseParams = {
  page: number;
  limit: number;
  search?: string;
};

export class HorsesService extends ApiService {
  async listHorses(params: HorseParams): Promise<PaginatedResponse<Horse>> {
    const query = this.buildQuery(params);

    return this.get<PaginatedResponse<Horse>>(`/api/horses?${query}`);
  }
}

export const horsesService = new HorsesService();
