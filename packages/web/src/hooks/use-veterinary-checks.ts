import { useCallback, useEffect, useRef, useState } from "react";

import { useNetworkStatus } from "@/components/network-status";
import { ApiError } from "@/services/api.service";
import type { StagedCategory, VeterinaryCheck, VeterinaryCheckStatus } from "@/types/staged-flow";
import {
  countBlockingMutationsForStage,
  getTrustedOfflineDevice,
  hasBlockingMutationsForStage,
  queueOfflineMutation,
} from "@/offline/offline-repository";
import { syncVeterinaryStage, type VetCheckMutationPayload } from "@/offline/sync-engine";
import {
  cacheVeterinaryStageSnapshot,
  patchVeterinaryStageSnapshot,
  readVeterinaryStageSnapshot,
} from "@/offline/vet-cache";

type UseVeterinaryChecksParams = {
  stageId: string;
  userId: string | null;
  summary: StagedCategory | null;
  onUpdateError?: (message?: string) => void;
  onSyncNotice?: (message: string) => void;
};

export function useVeterinaryChecks({
  stageId,
  userId,
  summary,
  onUpdateError,
  onSyncNotice,
}: UseVeterinaryChecksParams) {
  const { connectivityState } = useNetworkStatus();
  const [checks, setChecksState] = useState<VeterinaryCheck[]>([]);
  const [updatingVetByEntryId, setUpdatingVetByEntryId] = useState<Record<string, boolean>>({});
  const [pendingCount, setPendingCount] = useState(0);
  const [hasBlockingPending, setHasBlockingPending] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const requestVersionByEntryRef = useRef<Record<string, number>>({});
  const checksRef = useRef<VeterinaryCheck[]>([]);
  const summaryRef = useRef<StagedCategory | null>(summary);
  const syncInFlightRef = useRef(false);

  useEffect(() => {
    checksRef.current = checks;
  }, [checks]);

  useEffect(() => {
    summaryRef.current = summary;
  }, [summary]);

  const refreshPendingState = useCallback(async () => {
    if (!userId) {
      setPendingCount(0);
      setHasBlockingPending(false);
      return;
    }

    const [count, blocking] = await Promise.all([
      countBlockingMutationsForStage(userId, stageId),
      hasBlockingMutationsForStage(userId, stageId),
    ]);
    setPendingCount(count);
    setHasBlockingPending(blocking);
  }, [stageId, userId]);

  const setChecks = useCallback(
    async (nextChecks: VeterinaryCheck[], nextSummary?: StagedCategory) => {
      setChecksState(nextChecks);
      const currentSummary = nextSummary ?? summaryRef.current;
      if (userId && currentSummary) {
        summaryRef.current = currentSummary;
        await cacheVeterinaryStageSnapshot({
          userId,
          summary: currentSummary,
          checks: nextChecks,
        });
      }
      await refreshPendingState();
    },
    [refreshPendingState, userId]
  );

  const syncNow = useCallback(async () => {
    if (!userId || syncInFlightRef.current) {
      return { synced: 0, conflicts: 0, failed: 0, checks: null as VeterinaryCheck[] | null };
    }
    syncInFlightRef.current = true;
    setIsSyncing(true);
    try {
      const result = await syncVeterinaryStage(userId, stageId);
      if (result.checks) {
        setChecksState(result.checks);
        const currentSummary = summaryRef.current;
        if (currentSummary) {
          await cacheVeterinaryStageSnapshot({
            userId,
            summary: currentSummary,
            checks: result.checks,
          });
        }
      }
      await refreshPendingState();

      if (result.conflicts > 0) {
        onSyncNotice?.(
          "Hay conflictos de sincronización. Revisa los checkeos antes de cerrar la pre-pista."
        );
      }
      return result;
    } finally {
      syncInFlightRef.current = false;
      setIsSyncing(false);
    }
  }, [onSyncNotice, refreshPendingState, stageId, userId]);

  useEffect(() => {
    void refreshPendingState();
  }, [refreshPendingState, checks]);

  useEffect(() => {
    if (connectivityState !== "ONLINE" || !userId || pendingCount === 0) return;
    void syncNow();
    // Solo al recuperar ONLINE; syncNow se dispara también tras cada guardado local.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- evitar reentrada por identidad de syncNow
  }, [connectivityState]);

  const loadFromOfflineCache = useCallback(async (): Promise<{
    summary: StagedCategory;
    checks: VeterinaryCheck[];
  } | null> => {
    if (!userId) return null;
    const trusted = await getTrustedOfflineDevice();
    if (!trusted || trusted.userId !== userId) return null;

    const snapshot = await readVeterinaryStageSnapshot(userId, stageId);
    if (!snapshot) return null;
    setChecksState(snapshot.checks);
    await refreshPendingState();
    return snapshot;
  }, [refreshPendingState, stageId, userId]);

  const handleVetCheckUpdate = useCallback(
    async (fairEntryId: string, status: VeterinaryCheckStatus) => {
      if (!userId) return;
      const currentSummary = summaryRef.current;
      if (!currentSummary) return;

      const currentCheck = checksRef.current.find((check) => check.fairEntryId === fairEntryId);
      if (!currentCheck || currentCheck.status === status) return;

      const nextVersion = (requestVersionByEntryRef.current[fairEntryId] ?? 0) + 1;
      requestVersionByEntryRef.current[fairEntryId] = nextVersion;

      const optimisticChecks = checksRef.current.map((check) =>
        check.fairEntryId === fairEntryId ? { ...check, status } : check
      );
      setChecksState(optimisticChecks);
      setUpdatingVetByEntryId((prev) => ({ ...prev, [fairEntryId]: true }));

      try {
        const payload: VetCheckMutationPayload = {
          fairEntryId,
          status,
          notes: currentCheck.notes,
        };

        await queueOfflineMutation({
          deduplicationKey: `VET_CHECK:${stageId}:${fairEntryId}`,
          userId,
          stageId,
          aggregateType: "VET_CHECK",
          aggregateId: currentCheck.id,
          operationType: "UPDATE_VET_CHECK",
          baseRevision: currentCheck.revision,
          payload,
        });
        await patchVeterinaryStageSnapshot({
          userId,
          summary: currentSummary,
          checks: optimisticChecks,
        });
        await refreshPendingState();

        if (connectivityState === "ONLINE") {
          await syncNow();
          if (requestVersionByEntryRef.current[fairEntryId] !== nextVersion) return;
        }
      } catch (error) {
        if (requestVersionByEntryRef.current[fairEntryId] !== nextVersion) return;

        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "No se pudo guardar el checkeo veterinario.";
        onUpdateError?.(message);
      } finally {
        if (requestVersionByEntryRef.current[fairEntryId] === nextVersion) {
          setUpdatingVetByEntryId((prev) => ({ ...prev, [fairEntryId]: false }));
        }
      }
    },
    [connectivityState, onUpdateError, refreshPendingState, stageId, syncNow, userId]
  );

  return {
    checks,
    setChecks,
    updatingVetByEntryId,
    handleVetCheckUpdate,
    pendingCount,
    hasBlockingPending,
    isSyncing,
    syncNow,
    loadFromOfflineCache,
  };
}
