import { ApiService } from "@/services/api.service";
import type { ApiResponse, PaginatedResponse } from "@/types/common";
import type { SyncBatch, SyncBatchStatus, SyncEntityName, SyncError, SyncSummary } from "@/types/sync";

type BatchParams = {
  page: number;
  limit: number;
  entityName?: SyncEntityName;
  status?: SyncBatchStatus;
};

type ErrorParams = {
  page: number;
  limit: number;
};

export class SyncService extends ApiService {
  async getSummary(): Promise<ApiResponse<SyncSummary[]>> {
    return this.get<ApiResponse<SyncSummary[]>>("/api/sync/summary");
  }

  async run(entityName: SyncEntityName, file: File): Promise<ApiResponse<SyncBatch>> {
    const formData = new FormData();
    formData.set("file", file);

    return this.post<ApiResponse<SyncBatch>>(`/api/sync/${entityName}/run`, formData);
  }

  async listBatches(params: BatchParams): Promise<PaginatedResponse<SyncBatch>> {
    const query = this.buildQuery(params);

    return this.get<PaginatedResponse<SyncBatch>>(`/api/sync/batches?${query}`);
  }

  async getBatch(batchId: string): Promise<ApiResponse<SyncBatch>> {
    return this.get<ApiResponse<SyncBatch>>(`/api/sync/batches/${batchId}`);
  }

  async listErrors(batchId: string, params: ErrorParams): Promise<PaginatedResponse<SyncError>> {
    const query = this.buildQuery(params);

    return this.get<PaginatedResponse<SyncError>>(`/api/sync/batches/${batchId}/errors?${query}`);
  }

  async cleanupDevelopmentData(): Promise<ApiResponse<{ ok: true }>> {
    return this.post<ApiResponse<{ ok: true }>>("/api/sync/dev/cleanup", {
      confirm: "DELETE_SYNC_DATA",
    });
  }
}

export const syncService = new SyncService();
