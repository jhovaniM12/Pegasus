"use client";

import { useCallback, useEffect, useState } from "react";

import { getTrustedOfflineDevice } from "@/offline/offline-repository";
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
    setMetrics(await getOfflineSyncMetrics(nextUserId));
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), pollMs);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [pollMs, refresh]);

  const totalOpen =
    metrics.pendingCount + metrics.syncingCount + metrics.conflictCount + metrics.failedCount;

  return {
    userId,
    metrics,
    totalOpen,
    refresh,
  };
}
