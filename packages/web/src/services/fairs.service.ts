import { ApiService } from "@/services/api.service";
import type { ApiResponse, PaginatedResponse } from "@/types/common";
import type {
  Fair,
  FairDetail,
  FairEntriesGaitSummary,
  FairEntry,
  FairResult,
  FairStaff,
} from "@/types/fairs";

type PaginationParams = {
  page: number;
  limit: number;
};

type EntryParams = PaginationParams & {
  categoryId: string;
  search?: string;
};

type ResultsParams = PaginationParams & {
  categoryId: string;
};

export class FairsService extends ApiService {
  async listFairs(): Promise<PaginatedResponse<Fair>> {
    return this.get<PaginatedResponse<Fair>>("/api/fairs");
  }

  async getFair(fairId: string): Promise<ApiResponse<FairDetail>> {
    return this.get<ApiResponse<FairDetail>>(`/api/fairs/${fairId}`);
  }

  async getEntriesSummary(fairId: string): Promise<ApiResponse<FairEntriesGaitSummary[]>> {
    return this.get<ApiResponse<FairEntriesGaitSummary[]>>(`/api/fairs/${fairId}/entries/summary`);
  }

  async listEntries(fairId: string, params: EntryParams): Promise<PaginatedResponse<FairEntry>> {
    const query = this.buildQuery({
      page: params.page,
      limit: params.limit,
      categoryId: params.categoryId,
      q: params.search,
    });

    return this.get<PaginatedResponse<FairEntry>>(`/api/fairs/${fairId}/entries?${query}`);
  }

  async listResults(fairId: string, params: ResultsParams): Promise<PaginatedResponse<FairResult>> {
    const query = this.buildQuery({
      page: params.page,
      limit: params.limit,
      categoryId: params.categoryId,
    });

    return this.get<PaginatedResponse<FairResult>>(`/api/fairs/${fairId}/results?${query}`);
  }

  async listStaff(fairId: string, params: PaginationParams): Promise<PaginatedResponse<FairStaff>> {
    const query = this.buildQuery({
      page: params.page,
      limit: params.limit,
    });

    return this.get<PaginatedResponse<FairStaff>>(`/api/fairs/${fairId}/staff?${query}`);
  }
}

export const fairsService = new FairsService();

