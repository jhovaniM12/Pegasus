import type { OfflineAggregateType } from "./schema";

export type OfflineMutationEnvelope<TPayload> = {
  operationId: string;
  baseRevision: number;
  clientUpdatedAt: string;
  payload: TPayload;
};

export type OfflineMutationResult<TData> = {
  data: TData;
  sync: {
    operationId: string;
    applied: boolean;
    duplicate: boolean;
    revision: number;
    serverUpdatedAt: string;
  };
};

export type QueueOfflineMutationInput<TPayload> = {
  deduplicationKey: string;
  userId: string;
  stageId: string;
  aggregateType: OfflineAggregateType;
  aggregateId: string;
  operationType: string;
  baseRevision: number;
  payload: TPayload;
  clientUpdatedAt?: string;
};
