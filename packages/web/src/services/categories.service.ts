import { ApiService } from "@/services/api.service";
import type { ApiResponse, PaginatedResponse } from "@/types/common";
import type { Category, GaitOption } from "@/types/categories";

type CategoriesParams = {
  page: number;
  limit: number;
  gaitId?: string;
};

export class CategoriesService extends ApiService {
  async listCategories(params: CategoriesParams): Promise<PaginatedResponse<Category>> {
    const query = this.buildQuery({
      page: params.page,
      limit: params.limit,
      gaitId: params.gaitId,
    });

    return this.get<PaginatedResponse<Category>>(`/api/categories?${query}`);
  }

  async listGaits(): Promise<ApiResponse<GaitOption[]>> {
    return this.get<ApiResponse<GaitOption[]>>("/api/categories/gaits");
  }
}

export const categoriesService = new CategoriesService();

