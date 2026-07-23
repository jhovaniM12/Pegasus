import { getOfflineDatabase } from "./db";
import {
  clearOfflineDataForUser,
  listMutationsForUser,
  revokeOfflineDeviceTrust,
} from "./offline-repository";
import { recordOfflineTelemetry } from "./telemetry";

export const DEFAULT_CONFIRMATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const LAST_SUCCESSFUL_SYNC_META_KEY = "last-successful-sync-at";

export type OfflineSyncMetrics = {
  pendingCount: number;
  syncingCount: number;
  conflictCount: number;
  failedCount: number;
  oldestPendingAt: string | null;
  lastSuccessfulSyncAt: string | null;
};

export async function purgeExpiredOfflineConfirmations(
  now = Date.now()
): Promise<number> {
  const database = getOfflineDatabase();
  const confirmations = await database.offlineConfirmations.toArray();
  let removed = 0;

  await database.transaction("rw", database.offlineConfirmations, async () => {
    for (const confirmation of confirmations) {
      const expiresAt = Date.parse(confirmation.expiresAt);
      if (!Number.isFinite(expiresAt) || expiresAt > now) continue;
      await database.offlineConfirmations.delete(confirmation.operationId);
      removed += 1;
    }
  });

  return removed;
}

export async function markLastSuccessfulSyncAt(at = new Date().toISOString()): Promise<void> {
  await getOfflineDatabase().offlineMeta.put({
    key: LAST_SUCCESSFUL_SYNC_META_KEY,
    value: at,
    updatedAt: at,
  });
}

export async function getLastSuccessfulSyncAt(): Promise<string | null> {
  const meta = await getOfflineDatabase().offlineMeta.get(LAST_SUCCESSFUL_SYNC_META_KEY);
  return typeof meta?.value === "string" ? meta.value : null;
}

export async function getOfflineSyncMetrics(userId: string): Promise<OfflineSyncMetrics> {
  const mutations = await listMutationsForUser(userId);
  const pending = mutations.filter((mutation) => mutation.status === "PENDING");
  const syncing = mutations.filter((mutation) => mutation.status === "SYNCING");
  const conflicts = mutations.filter((mutation) => mutation.status === "CONFLICT");
  const failed = mutations.filter((mutation) => mutation.status === "FAILED");
  const oldestPendingAt =
    pending.length > 0
      ? [...pending].sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0]
          ?.createdAt ?? null
      : null;

  return {
    pendingCount: pending.length,
    syncingCount: syncing.length,
    conflictCount: conflicts.length,
    failedCount: failed.length,
    oldestPendingAt,
    lastSuccessfulSyncAt: await getLastSuccessfulSyncAt(),
  };
}

/**
 * Limpieza al cerrar sesión: si hay pendientes, los conserva aislados y avisa.
 * Si no hay pendientes, limpia contexto/confirmaciones y revoca la confianza del dispositivo.
 */
export async function prepareStaffLogoutOffline(userId: string): Promise<{
  blockedByPending: boolean;
  pendingCount: number;
}> {
  const mutations = await listMutationsForUser(userId);
  if (mutations.length > 0) {
    recordOfflineTelemetry("OFFLINE_LOGOUT_BLOCKED_BY_PENDING", {
      userId,
      pendingCount: mutations.length,
    });
    return { blockedByPending: true, pendingCount: mutations.length };
  }

  await clearOfflineDataForUser(userId);
  await revokeOfflineDeviceTrust();
  return { blockedByPending: false, pendingCount: 0 };
}
