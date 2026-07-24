import { ApiService } from "@/services/api.service";
import type { ApiResponse, PaginatedResponse } from "@/types/common";
import type {
  FedequinasApplyResult,
  FedequinasFairStatus,
  FedequinasFileKind,
  FedequinasPreview,
  SyncBatch,
  SyncBatchStatus,
  SyncEntityName,
  SyncError,
  SyncSummary,
} from "@/types/sync";

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

  async previewFedequinas(
    fileKind: FedequinasFileKind,
    file: File
  ): Promise<ApiResponse<FedequinasPreview>> {
    const formData = new FormData();
    formData.set("file", file);

    return this.post<ApiResponse<FedequinasPreview>>(
      `/api/sync/fedequinas/${fileKind}/preview`,
      formData
    );
  }

  async applyFedequinas(
    fileKind: FedequinasFileKind,
    file: File,
    previewToken: string,
    checksum: string
  ): Promise<ApiResponse<FedequinasApplyResult>> {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("previewToken", previewToken);
    formData.set("checksum", checksum);

    return this.post<ApiResponse<FedequinasApplyResult>>(
      `/api/sync/fedequinas/${fileKind}/apply`,
      formData
    );
  }

  async getFedequinasFairStatus(
    fairExternalId: string
  ): Promise<ApiResponse<FedequinasFairStatus>> {
    return this.get<ApiResponse<FedequinasFairStatus>>(
      `/api/sync/fedequinas/fairs/${encodeURIComponent(fairExternalId)}/status`
    );
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
