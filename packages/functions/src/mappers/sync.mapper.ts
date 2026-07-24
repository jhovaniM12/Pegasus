import type { SyncBatch, SyncError } from "@pegasus/core";
import type { SyncSummary } from "../services/sync.service.js";

export type SyncBatchDto = {
  id: string;
  sourceSystem: string;
  entityName: string;
  fileKind: string | null;
  fairExternalId: string | null;
  fileName: string;
  fileSize: number;
  fileChecksum: string;
  status: string;
  totalRows: number;
  insertedRows: number;
  updatedRows: number;
  skippedRows: number;
  failedRows: number;
  warningRows: number;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  createdBy: string;
};

export type SyncErrorDto = {
  id: string;
  batchId: string;
  entityName: string;
  rowNumber: number;
  externalId: string | null;
  errorCode: string;
  errorMessage: string;
  rawRow: Record<string, string>;
  createdAt: string;
};

export type SyncSummaryDto = {
  entityName: string;
  lastBatch: SyncBatchDto | null;
};

export function toSyncBatchDto(batch: SyncBatch): SyncBatchDto {
  return {
    id: batch.id,
    sourceSystem: batch.sourceSystem,
    entityName: batch.entityName,
    fileKind: batch.fileKind,
    fairExternalId: batch.fairExternalId,
    fileName: batch.fileName,
    fileSize: batch.fileSize,
    fileChecksum: batch.fileChecksum,
    status: batch.status,
    totalRows: batch.totalRows,
    insertedRows: batch.insertedRows,
    updatedRows: batch.updatedRows,
    skippedRows: batch.skippedRows,
    failedRows: batch.failedRows,
    warningRows: batch.warningRows,
    startedAt: batch.startedAt.toISOString(),
    finishedAt: batch.finishedAt?.toISOString() ?? null,
    errorMessage: batch.errorMessage,
    createdBy: batch.createdBy
  };
}

export function toSyncErrorDto(error: SyncError): SyncErrorDto {
  return {
    id: error.id,
    batchId: error.batchId,
    entityName: error.entityName,
    rowNumber: error.rowNumber,
    externalId: error.externalId,
    errorCode: error.errorCode,
    errorMessage: error.errorMessage,
    rawRow: error.rawRow,
    createdAt: error.createdAt.toISOString()
  };
}

export function toSyncSummaryDto(summary: SyncSummary): SyncSummaryDto {
  return {
    entityName: summary.entityName,
    lastBatch: summary.lastBatch ? toSyncBatchDto(summary.lastBatch) : null
  };
}
