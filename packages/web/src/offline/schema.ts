import type { StageStatus } from "@/types/staged-flow";

export const OFFLINE_SCHEMA_VERSION = 1;

export type OfflineRole = "JUDGE" | "VETERINARIAN" | "TECHNICAL_DIRECTOR";

export type OfflineAggregateType =
  | "VET_CHECK"
  | "FA_FORM"
  | "ROUND_FORM"
  | "ROUND_NOTE"
  | "ROUND_REMINDERS";

export type OfflineMutationStatus = "PENDING" | "SYNCING" | "CONFLICT" | "FAILED";

export type OfflineContext<TPayload = unknown> = {
  key: string;
  userId: string;
  role: OfflineRole;
  stageId: string;
  fairId: string;
  stageRevision: number;
  stageStatus: StageStatus;
  activeRoundId: string | null;
  activeTieBlockIdentity: string | null;
  payload: TPayload;
  cachedAt: string;
  lastServerSyncAt: string;
  schemaVersion: number;
};

export type OfflineMutation<TPayload = unknown> = {
  operationId: string;
  deduplicationKey: string;
  userId: string;
  stageId: string;
  aggregateType: OfflineAggregateType;
  aggregateId: string;
  operationType: string;
  baseRevision: number;
  payload: TPayload;
  status: OfflineMutationStatus;
  attempts: number;
  nextRetryAt: string | null;
  createdAt: string;
  clientUpdatedAt: string;
  lastAttemptAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

export type OfflineConfirmation<TPayload = unknown> = {
  operationId: string;
  userId: string;
  stageId: string;
  aggregateId: string;
  appliedRevision: number;
  responsePayload: TPayload;
  confirmedAt: string;
  expiresAt: string;
};

export type OfflineMeta<TValue = unknown> = {
  key: string;
  value: TValue;
  updatedAt: string;
};

export type TrustedOfflineDevice = {
  userId: string;
  preparedAt: string;
  trustedUntil: string;
};

export function offlineContextKey(userId: string, stageId: string): string {
  return `${userId}:${stageId}`;
}
