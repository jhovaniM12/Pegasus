export type SyncBatchStatus =
  | "PROCESSING"
  | "COMPLETED"
  | "COMPLETED_WITH_ERRORS"
  | "FAILED";

export type SyncEntityName = "people" | "horses" | "fair_staff" | "fair_entries";

export type SyncBatch = {
  id: string;
  sourceSystem: string;
  entityName: SyncEntityName;
  fileName: string;
  fileSize: number;
  fileChecksum: string;
  status: SyncBatchStatus;
  totalRows: number;
  insertedRows: number;
  updatedRows: number;
  skippedRows: number;
  failedRows: number;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  createdBy: string;
};

export type SyncSummary = {
  entityName: SyncEntityName;
  lastBatch: SyncBatch | null;
};

export type SyncError = {
  id: string;
  batchId: string;
  entityName: SyncEntityName;
  rowNumber: number;
  externalId: string | null;
  errorCode: string;
  errorMessage: string;
  rawRow: Record<string, string>;
  createdAt: string;
};
