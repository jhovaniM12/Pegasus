"use client";

import { useCallback, useEffect, useState } from "react";
import { syncService } from "@/services/sync.service";
import type { PaginationMeta } from "@/types/common";
import type { SyncBatch, SyncEntityName, SyncError, SyncSummary } from "@/types/sync";

const emptyMeta: PaginationMeta = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
};

export function useSyncDashboard() {
  const [summaries, setSummaries] = useState<SyncSummary[]>([]);
  const [batches, setBatches] = useState<SyncBatch[]>([]);
  const [errors, setErrors] = useState<SyncError[]>([]);
  const [historyMeta, setHistoryMeta] = useState<PaginationMeta>(emptyMeta);
  const [errorsMeta, setErrorsMeta] = useState<PaginationMeta>(emptyMeta);
  const [selectedBatch, setSelectedBatch] = useState<SyncBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningEntity, setRunningEntity] = useState<SyncEntityName | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const refreshSummary = useCallback(async () => {
    const response = await syncService.getSummary();
    setSummaries(response.data || []);
  }, []);

  const refreshBatches = useCallback(async () => {
    const response = await syncService.listBatches({ page: 1, limit: 10 });
    setBatches(response.data || []);
    setHistoryMeta(response.meta || emptyMeta);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([refreshSummary(), refreshBatches()]);
    } finally {
      setLoading(false);
    }
  }, [refreshBatches, refreshSummary]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runSync = useCallback(
    async (entityName: SyncEntityName, file: File) => {
      setRunningEntity(entityName);
      try {
        const response = await syncService.run(entityName, file);
        await refresh();
        return response.data;
      } finally {
        setRunningEntity(null);
      }
    },
    [refresh]
  );

  const loadErrors = useCallback(async (batch: SyncBatch) => {
    setSelectedBatch(batch);
    const response = await syncService.listErrors(batch.id, { page: 1, limit: 20 });
    setErrors(response.data || []);
    setErrorsMeta(response.meta || { ...emptyMeta, limit: 20 });
  }, []);

  const cleanup = useCallback(async () => {
    setCleaning(true);
    try {
      await syncService.cleanupDevelopmentData();
      await refresh();
      setSelectedBatch(null);
      setErrors([]);
    } finally {
      setCleaning(false);
    }
  }, [refresh]);

  return {
    summaries,
    batches,
    errors,
    historyMeta,
    errorsMeta,
    selectedBatch,
    loading,
    runningEntity,
    cleaning,
    refresh,
    runSync,
    loadErrors,
    cleanup,
  };
}
