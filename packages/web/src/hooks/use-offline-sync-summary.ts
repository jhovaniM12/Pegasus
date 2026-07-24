"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getTrustedOfflineDevice,
  recoverStaleSyncingMutations,
} from "@/offline/offline-repository";
import { OFFLINE_MUTATIONS_CHANGED_EVENT } from "@/offline/offline-events";
import { getOfflineSyncMetrics, type OfflineSyncMetrics } from "@/offline/retention";

const EMPTY_METRICS: OfflineSyncMetrics = {
  pendingCount: 0,
  syncingCount: 0,
  conflictCount: 0,
  failedCount: 0,
  oldestPendingAt: null,
  lastSuccessfulSyncAt: null,
};

export function useOfflineSyncSummary(pollMs = 8_000) {
  const [userId, setUserId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<OfflineSyncMetrics>(EMPTY_METRICS);

  const refresh = useCallback(async () => {
    const trusted = await getTrustedOfflineDevice();
    const nextUserId = trusted?.userId ?? null;
    setUserId(nextUserId);
    if (!nextUserId) {
      setMetrics(EMPTY_METRICS);
      return;
    }
    // Tras reload/SW, las SYNCING de la página anterior vuelven a PENDING de inmediato.
    await recoverStaleSyncingMutations(nextUserId);
    setMetrics(await getOfflineSyncMetrics(nextUserId));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza métricas offline al montar/cambiar contexto
    void refresh();
    const onFocus = () => void refresh();
    const onMutationsChanged = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener(OFFLINE_MUTATIONS_CHANGED_EVENT, onMutationsChanged);

    const activePollMs =
      metrics.pendingCount + metrics.syncingCount > 0 ? Math.min(pollMs, 1_500) : pollMs;
    const timer = window.setInterval(() => void refresh(), activePollMs);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(OFFLINE_MUTATIONS_CHANGED_EVENT, onMutationsChanged);
    };
  }, [
    metrics.pendingCount,
    metrics.syncingCount,
    pollMs,
    refresh,
  ]);

  const totalOpen =
    metrics.pendingCount + metrics.syncingCount + metrics.conflictCount + metrics.failedCount;

  return {
    userId,
    metrics,
    totalOpen,
    refresh,
  };
}
