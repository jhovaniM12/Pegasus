import { createHash } from "node:crypto";
import {
  OfflineOperationReceipt,
  type OfflineAggregateType,
} from "@pegasus/core";
import type { EntityManager } from "typeorm";
import {
  IdempotencyKeyReusedError,
  RevisionConflictError,
  type RevisionConflictDetails,
} from "../lib/errors.js";

export type IdempotentMutationInput<TResponse> = {
  operationId: string;
  userId: string;
  stageId: string;
  aggregateType: OfflineAggregateType;
  aggregateId: string;
  operationType: string;
  baseRevision: number;
  requestPayload: unknown;
  apply: () => Promise<{
    responsePayload: TResponse;
    responseStatus?: number;
    appliedRevision: number | null;
  }>;
};

export type IdempotentMutationResult<TResponse> = {
  responsePayload: TResponse;
  responseStatus: number;
  appliedRevision: number | null;
  duplicate: boolean;
};

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }

  const entries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalize(entryValue)}`)
    .join(",")}}`;
}

export function buildOfflineRequestHash(input: {
  userId: string;
  stageId: string;
  aggregateType: OfflineAggregateType;
  aggregateId: string;
  operationType: string;
  baseRevision: number;
  requestPayload: unknown;
}): string {
  return createHash("sha256").update(canonicalize(input)).digest("hex");
}

export function assertExpectedRevision(
  expectedRevision: number,
  currentRevision: number,
  details: Omit<RevisionConflictDetails, "expectedRevision" | "currentRevision">
): void {
  if (expectedRevision === currentRevision) return;

  throw new RevisionConflictError({
    ...details,
    expectedRevision,
    currentRevision,
  });
}

export async function executeIdempotentMutation<TResponse>(
  manager: EntityManager,
  input: IdempotentMutationInput<TResponse>
): Promise<IdempotentMutationResult<TResponse>> {
  if (!manager.queryRunner?.isTransactionActive) {
    throw new Error("La mutación idempotente debe ejecutarse dentro de una transacción.");
  }

  const requestHash = buildOfflineRequestHash({
    userId: input.userId,
    stageId: input.stageId,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    operationType: input.operationType,
    baseRevision: input.baseRevision,
    requestPayload: input.requestPayload,
  });

  // Serializa reintentos concurrentes del mismo operationId antes de consultar
  // o crear el recibo. El advisory lock se libera junto con la transacción.
  await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [input.operationId]);

  const repository = manager.getRepository(OfflineOperationReceipt);
  const existing = await repository.findOne({ where: { operationId: input.operationId } });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new IdempotencyKeyReusedError(input.operationId);
    }

    return {
      responsePayload: existing.responsePayload as TResponse,
      responseStatus: existing.responseStatus,
      appliedRevision: existing.appliedRevision,
      duplicate: true,
    };
  }

  const applied = await input.apply();
  const responseStatus = applied.responseStatus ?? 200;
  const receipt = repository.create({
    operationId: input.operationId,
    userId: input.userId,
    fairCategoryStageId: input.stageId,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    requestHash,
    responseStatus,
    responsePayload: applied.responsePayload,
    appliedRevision: applied.appliedRevision,
  });
  await repository.save(receipt);

  return {
    responsePayload: applied.responsePayload,
    responseStatus,
    appliedRevision: applied.appliedRevision,
    duplicate: false,
  };
}
