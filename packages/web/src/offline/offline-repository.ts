import { getOfflineDatabase } from "./db";
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
    };
    await database.offlineMutations.add(mutation);
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
}

export async function clearOfflineDataForUser(userId: string): Promise<void> {
  const database = getOfflineDatabase();

  await database.transaction(
    "rw",
    database.offlineContexts,
    database.offlineMutations,
    database.offlineConfirmations,
    async () => {
      const pendingCount = await database.offlineMutations.where("userId").equals(userId).count();
      if (pendingCount > 0) {
        throw new Error("No se pueden limpiar datos offline mientras existan cambios pendientes.");
      }

      await database.offlineContexts.where("userId").equals(userId).delete();
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
