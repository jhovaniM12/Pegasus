export type SyncBatchStatus =
  | "PROCESSING"
  | "COMPLETED"
  | "COMPLETED_WITH_ERRORS"
  | "FAILED";

export type SyncEntityName = "people" | "horses" | "fair_staff" | "fair_entries";
export type SyncBatchEntityName = SyncEntityName | "fairs";

export const FEDEQUINAS_FILE_KINDS = [
  "FEH_FERIAS",
  "FEH_PERSONAL_FERIA",
  "FEH_INSCRIPCIONES_FERIA",
  "FEH_INSCRIPCIONES_FERIA_PADRES",
] as const;

export type FedequinasFileKind = (typeof FEDEQUINAS_FILE_KINDS)[number];

export type FedequinasImportStatus =
  | "LOCKED"
  | "READY"
  | "UPLOADING"
  | "PARSING"
  | "ANALYZING"
  | "PREVIEW"
  | "APPLYING"
  | "COMPLETED"
  | "COMPLETED_WITH_WARNINGS"
  | "FAILED";

export type FedequinasIssueSeverity = "warning" | "error";

export type FedequinasIssue = {
  severity: FedequinasIssueSeverity;
  row: number;
  code: string;
  message: string;
};

export type FedequinasCounts = {
  total: number;
  inserts: number;
  updates: number;
  skips: number;
  warnings: number;
  errors: number;
};

export type FedequinasPreview = {
  checksum: string;
  previewToken: string;
  detectedFairExternalId: string;
  headers: string[];
  counts: FedequinasCounts;
  issues: FedequinasIssue[];
};

export type FedequinasStepBatch = {
  id: string;
  fileName: string;
  checksum: string;
  startedAt: string;
  finishedAt: string | null;
  counts: FedequinasCounts;
};

export type FedequinasFairStepStatus = {
  fileKind: FedequinasFileKind;
  status: "LOCKED" | "READY" | "COMPLETED" | "COMPLETED_WITH_WARNINGS" | "FAILED";
  batch: FedequinasStepBatch | null;
};

export type FedequinasFairStatus = {
  fairExternalId: string;
  steps: FedequinasFairStepStatus[];
};

export type FedequinasApplyResult = {
  batch: SyncBatch;
  result: FedequinasPreview;
};

export type FedequinasImportStep = {
  fileKind: FedequinasFileKind;
  status: FedequinasImportStatus;
  file: File | null;
  preview: FedequinasPreview | null;
  batch: FedequinasStepBatch | null;
  error: string | null;
};

export type SyncBatch = {
  id: string;
  sourceSystem: string;
  entityName: SyncBatchEntityName;
  fileKind?: FedequinasFileKind | null;
  fairExternalId?: string | null;
  fileName: string;
  fileSize: number;
  fileChecksum: string;
  status: SyncBatchStatus;
  totalRows: number;
  insertedRows: number;
  updatedRows: number;
  skippedRows: number;
  failedRows: number;
  warningRows?: number;
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
