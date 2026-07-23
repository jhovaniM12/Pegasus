import { getOfflineDatabase } from "./db";
import { notifyOfflineMutationsChanged } from "./offline-events";
import type { QueueOfflineMutationInput } from "./mutation-types";
import {
  OFFLINE_SCHEMA_VERSION,
  offlineContextKey,
  type OfflineConfirmation,
  type OfflineContext,
  type OfflineMutation,
  type OfflineMutationStatus,
  type TrustedOfflineDevice,
} from "./schema";

const TRUSTED_DEVICE_META_KEY = "trusted-offline-device";
const ACTIVE_MUTATION_STATUSES: OfflineMutationStatus[] = [
  "PENDING",
  "SYNCING",
  "CONFLICT",
  "FAILED",
];
/** Misma página: solo recupera SYNCING colgados tras este margen. */
export const SYNCING_STALE_AFTER_MS = 15_000;
/** Arranque de este documento JS; mutaciones SYNCING anteriores son huérfanas tras reload. */
let offlinePageBootAtMs = Date.now();

export function getOfflinePageBootAtMs(): number {
  return offlinePageBootAtMs;
}

/** Solo para tests. */
export function setOfflinePageBootAtMsForTests(value: number): void {
  offlinePageBootAtMs = value;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function cacheOfflineContext<TPayload>(
  context: Omit<OfflineContext<TPayload>, "key" | "cachedAt" | "schemaVersion">
): Promise<OfflineContext<TPayload>> {
  const database = getOfflineDatabase();
  const cachedContext: OfflineContext<TPayload> = {
    ...context,
    key: offlineContextKey(context.userId, context.stageId),
    cachedAt: nowIso(),
    schemaVersion: OFFLINE_SCHEMA_VERSION,
  };

  await database.offlineContexts.put(cachedContext);
  return cachedContext;
}

export async function getOfflineContext<TPayload>(
  userId: string,
  stageId: string
): Promise<OfflineContext<TPayload> | null> {
  const context = await getOfflineDatabase().offlineContexts.get(
    offlineContextKey(userId, stageId)
  );

  if (!context || context.userId !== userId || context.schemaVersion !== OFFLINE_SCHEMA_VERSION) {
    return null;
  }

  return context as OfflineContext<TPayload>;
}

export async function listOfflineContextsForUser(userId: string): Promise<OfflineContext[]> {
  return getOfflineDatabase().offlineContexts.where("userId").equals(userId).toArray();
}

export async function queueOfflineMutation<TPayload>(
  input: QueueOfflineMutationInput<TPayload>
): Promise<OfflineMutation<TPayload>> {
  const database = getOfflineDatabase();

  return database.transaction("rw", database.offlineMutations, async () => {
    const existingPending = await database.offlineMutations
      .where("[userId+deduplicationKey]")
      .equals([input.userId, input.deduplicationKey])
      .filter((mutation) => mutation.status === "PENDING")
      .first();
    const clientUpdatedAt = input.clientUpdatedAt ?? nowIso();

    if (existingPending) {
      const updated: OfflineMutation<TPayload> = {
        ...existingPending,
        payload: input.payload,
        clientUpdatedAt,
        nextRetryAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastErrorDetails: null,
      };
      await database.offlineMutations.put(updated);
      return updated;
    }

    const mutation: OfflineMutation<TPayload> = {
      ...input,
      operationId: crypto.randomUUID(),
      status: "PENDING",
      attempts: 0,
      nextRetryAt: null,
      createdAt: clientUpdatedAt,
      clientUpdatedAt,
      lastAttemptAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      lastErrorDetails: null,
    };
    await database.offlineMutations.add(mutation);
    return mutation;
  }).then((mutation) => {
    notifyOfflineMutationsChanged();
    return mutation;
  });
}

export async function listMutationsForUser(
  userId: string,
  statuses: OfflineMutationStatus[] = ACTIVE_MUTATION_STATUSES
): Promise<OfflineMutation[]> {
  const mutations = await getOfflineDatabase().offlineMutations.where("userId").equals(userId).toArray();
  const allowedStatuses = new Set(statuses);

  return mutations
    .filter((mutation) => allowedStatuses.has(mutation.status))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function hasBlockingMutations(userId: string, aggregateId: string): Promise<boolean> {
  const mutations = await getOfflineDatabase().offlineMutations
    .where("aggregateId")
    .equals(aggregateId)
    .toArray();

  return mutations.some(
    (mutation) => mutation.userId === userId && ACTIVE_MUTATION_STATUSES.includes(mutation.status)
  );
}

export async function hasBlockingMutationsForStage(userId: string, stageId: string): Promise<boolean> {
  const mutations = await getOfflineDatabase().offlineMutations.where("stageId").equals(stageId).toArray();
  return mutations.some(
    (mutation) => mutation.userId === userId && ACTIVE_MUTATION_STATUSES.includes(mutation.status)
  );
}

export async function countBlockingMutationsForStage(userId: string, stageId: string): Promise<number> {
  const mutations = await getOfflineDatabase().offlineMutations.where("stageId").equals(stageId).toArray();
  return mutations.filter(
    (mutation) => mutation.userId === userId && ACTIVE_MUTATION_STATUSES.includes(mutation.status)
  ).length;
}

export async function listPendingMutationsForStage(
  userId: string,
  stageId: string
): Promise<OfflineMutation[]> {
  const mutations = await getOfflineDatabase().offlineMutations.where("stageId").equals(stageId).toArray();
  return mutations
    .filter((mutation) => mutation.userId === userId && mutation.status === "PENDING")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function listMutationsForStage(
  userId: string,
  stageId: string,
  statuses: OfflineMutationStatus[] = ACTIVE_MUTATION_STATUSES
): Promise<OfflineMutation[]> {
  const allowedStatuses = new Set(statuses);
  const mutations = await getOfflineDatabase().offlineMutations.where("stageId").equals(stageId).toArray();
  return mutations
    .filter((mutation) => mutation.userId === userId && allowedStatuses.has(mutation.status))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function recoverStaleSyncingMutations(
  userId?: string,
  stageId?: string,
  options: { now?: number; staleAfterMs?: number } = {}
): Promise<number> {
  const database = getOfflineDatabase();
  const now = options.now ?? Date.now();
  const staleAfterMs = options.staleAfterMs ?? SYNCING_STALE_AFTER_MS;
  const staleBefore = now - staleAfterMs;
  const pageBootAtMs = offlinePageBootAtMs;
  const candidates = await database.offlineMutations.where("status").equals("SYNCING").toArray();
  let recovered = 0;

  await database.transaction("rw", database.offlineMutations, async () => {
    for (const mutation of candidates) {
      if (userId && mutation.userId !== userId) continue;
      if (stageId && mutation.stageId !== stageId) continue;

      const lastAttempt = mutation.lastAttemptAt ? Date.parse(mutation.lastAttemptAt) : 0;
      const fromPreviousPage = !Number.isFinite(lastAttempt) || lastAttempt < pageBootAtMs;
      const staleByAge = !Number.isFinite(lastAttempt) || lastAttempt <= staleBefore;
      if (!fromPreviousPage && !staleByAge) continue;

      await database.offlineMutations.put({
        ...mutation,
        status: "PENDING",
        nextRetryAt: null,
        lastErrorCode: "SYNC_INTERRUPTED",
        lastErrorMessage: "La sincronización fue interrumpida y será reintentada.",
        lastErrorDetails: null,
      });
      recovered += 1;
    }
  });

  if (recovered > 0) {
    notifyOfflineMutationsChanged();
  }
  return recovered;
}

export async function retryOfflineMutation(
  operationId: string,
  options: { reapplyLocal?: boolean } = {}
): Promise<OfflineMutation | null> {
  const database = getOfflineDatabase();
  const mutation = await database.offlineMutations.get(operationId);
  if (!mutation || !["CONFLICT", "FAILED"].includes(mutation.status)) return mutation ?? null;

  const currentRevision =
    options.reapplyLocal &&
    mutation.lastErrorDetails &&
    typeof mutation.lastErrorDetails === "object" &&
    typeof (mutation.lastErrorDetails as { currentRevision?: unknown }).currentRevision === "number"
      ? (mutation.lastErrorDetails as { currentRevision: number }).currentRevision
      : mutation.baseRevision;

  const updated: OfflineMutation = {
    ...mutation,
    status: "PENDING",
    baseRevision: currentRevision,
    nextRetryAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastErrorDetails: null,
  };
  await database.offlineMutations.put(updated);
  notifyOfflineMutationsChanged();
  return updated;
}

export async function discardOfflineMutation(operationId: string): Promise<boolean> {
  const database = getOfflineDatabase();
  const mutation = await database.offlineMutations.get(operationId);
  if (!mutation || mutation.status === "SYNCING") return false;
  await database.offlineMutations.delete(operationId);
  notifyOfflineMutationsChanged();
  return true;
}

export async function markMutationStatus(
  operationId: string,
  patch: Partial<
    Pick<
      OfflineMutation,
      "status" | "attempts" | "nextRetryAt" | "lastAttemptAt" | "lastErrorCode" | "lastErrorMessage" | "baseRevision"
      | "lastErrorDetails"
    >
  >
): Promise<OfflineMutation | null> {
  const database = getOfflineDatabase();
  const existing = await database.offlineMutations.get(operationId);
  if (!existing) return null;

  const updated: OfflineMutation = { ...existing, ...patch };
  await database.offlineMutations.put(updated);
  notifyOfflineMutationsChanged();
  return updated;
}

/**
 * Tras aplicar una mutación, avanza `baseRevision` de las PENDING hermanas
 * que compartían la revisión anterior del mismo agregado/revisión de formulario.
 */
export async function advancePendingBaseRevisions(params: {
  userId: string;
  stageId: string;
  appliedRevision: number;
  match: (mutation: OfflineMutation) => boolean;
}): Promise<number> {
  const database = getOfflineDatabase();
  let advanced = 0;

  await database.transaction("rw", database.offlineMutations, async () => {
    const candidates = await database.offlineMutations.where("stageId").equals(params.stageId).toArray();
    for (const mutation of candidates) {
      if (mutation.userId !== params.userId) continue;
      if (mutation.status !== "PENDING") continue;
      if (!params.match(mutation)) continue;
      if (mutation.baseRevision >= params.appliedRevision) continue;

      await database.offlineMutations.put({
        ...mutation,
        baseRevision: params.appliedRevision,
      });
      advanced += 1;
    }
  });

  return advanced;
}

export async function confirmOfflineMutation<TPayload>(
  confirmation: OfflineConfirmation<TPayload>
): Promise<void> {
  const database = getOfflineDatabase();

  await database.transaction(
    "rw",
    database.offlineMutations,
    database.offlineConfirmations,
    async () => {
      const mutation = await database.offlineMutations.get(confirmation.operationId);
      if (mutation && mutation.userId !== confirmation.userId) {
        throw new Error("La confirmación no pertenece al usuario de la mutación.");
      }

      await database.offlineConfirmations.put(confirmation);
      await database.offlineMutations.delete(confirmation.operationId);
    }
  );
  notifyOfflineMutationsChanged();
}

export async function clearOfflineDataForUser(userId: string): Promise<void> {
  const database = getOfflineDatabase();

  await database.transaction(
    "rw",
    database.offlineContexts,
    database.offlineMutations,
    database.offlineConfirmations,
    async () => {
      await database.offlineContexts.where("userId").equals(userId).delete();
      await database.offlineMutations.where("userId").equals(userId).delete();
      await database.offlineConfirmations.where("userId").equals(userId).delete();
    }
  );
}

export async function trustOfflineDevice(
  userId: string,
  trustedUntil: string
): Promise<TrustedOfflineDevice> {
  const trustedUntilDate = new Date(trustedUntil);
  if (!Number.isFinite(trustedUntilDate.getTime()) || trustedUntilDate <= new Date()) {
    throw new Error("La fecha de confianza del dispositivo debe estar en el futuro.");
  }

  const database = getOfflineDatabase();
  const trustedDevice: TrustedOfflineDevice = {
    userId,
    preparedAt: nowIso(),
    trustedUntil: trustedUntilDate.toISOString(),
  };
  await database.offlineMeta.put({
    key: TRUSTED_DEVICE_META_KEY,
    value: trustedDevice,
    updatedAt: trustedDevice.preparedAt,
  });

  return trustedDevice;
}

export async function getTrustedOfflineDevice(): Promise<TrustedOfflineDevice | null> {
  const meta = await getOfflineDatabase().offlineMeta.get(TRUSTED_DEVICE_META_KEY);
  if (!meta) return null;

  const trustedDevice = meta.value as TrustedOfflineDevice;
  const trustedUntil = new Date(trustedDevice?.trustedUntil);
  if (
    typeof trustedDevice?.userId !== "string" ||
    typeof trustedDevice.trustedUntil !== "string" ||
    !Number.isFinite(trustedUntil.getTime()) ||
    trustedUntil <= new Date()
  ) {
    return null;
  }

  return trustedDevice;
}

export async function revokeOfflineDeviceTrust(): Promise<void> {
  await getOfflineDatabase().offlineMeta.delete(TRUSTED_DEVICE_META_KEY);
}
