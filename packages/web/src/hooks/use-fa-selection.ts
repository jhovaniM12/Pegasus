import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useNetworkStatus } from "@/components/network-status";
import { ApiError } from "@/services/api.service";
import type { FaState, StagedCategory } from "@/types/staged-flow";
import { cacheFaStageSnapshot, readFaStageSnapshot } from "@/offline/fa-cache";
import {
  countBlockingMutationsForStage,
  getTrustedOfflineDevice,
  hasBlockingMutationsForStage,
  queueOfflineMutation,
} from "@/offline/offline-repository";
import { syncFaStage, type FaSelectionMutationPayload } from "@/offline/sync-engine";

const FA_SYNC_DEBOUNCE_MS = 400;

type UseFaSelectionParams = {
  stageId: string;
  userId: string | null;
  fa: FaState | null;
  summaryStatus: StagedCategory["status"] | undefined;
  onFaChange: (fa: FaState) => void;
  onUpdateError?: (message?: string) => void;
  onSyncNotice?: (message: string) => void;
};

function extractSelectedParticipantIds(state: FaState): string[] {
  return state.participants
    .filter((participant) => participant.decision?.decision === "SELECTED")
    .map((participant) => participant.id);
}

export function useFaSelection({
  stageId,
  userId,
  fa,
  summaryStatus,
  onFaChange,
  onUpdateError,
  onSyncNotice,
}: UseFaSelectionParams) {
  const { connectivityState } = useNetworkStatus();
  const [selectedIdsLocal, setSelectedIdsLocal] = useState<string[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [hasBlockingPending, setHasBlockingPending] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const localSelectionRef = useRef<string[]>([]);
  const faRef = useRef<FaState | null>(fa);
  const isClosingFaRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const selectionVersionRef = useRef(0);
  const syncDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    faRef.current = fa;
  }, [fa]);

  useEffect(
    () => () => {
      if (syncDebounceTimerRef.current) {
        clearTimeout(syncDebounceTimerRef.current);
      }
    },
    []
  );

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

  const adoptSelection = useCallback((ids: string[]) => {
    localSelectionRef.current = ids;
    setSelectedIdsLocal(ids);
  }, []);

  useEffect(() => {
    if (!fa) {
      adoptSelection([]);
      isClosingFaRef.current = false;
      return;
    }

    void (async () => {
      const hasPending =
        userId != null ? await hasBlockingMutationsForStage(userId, stageId) : false;
      if (hasPending || isClosingFaRef.current) {
        await refreshPendingState();
        return;
      }

      adoptSelection(extractSelectedParticipantIds(fa));
      await refreshPendingState();
    })();
  }, [adoptSelection, fa, refreshPendingState, stageId, userId]);

  const cacheCurrentSnapshot = useCallback(
    async (nextFa: FaState, selectedParticipantIds: string[]) => {
      if (!userId) return;
      await cacheFaStageSnapshot({
        userId,
        fa: nextFa,
        selectedParticipantIds,
      });
    },
    [userId]
  );

  const syncNow = useCallback(async () => {
    if (!userId || syncInFlightRef.current) {
      return { synced: 0, conflicts: 0, failed: 0, fa: null as FaState | null };
    }

    syncInFlightRef.current = true;
    setIsSyncing(true);
    try {
      const result = await syncFaStage(userId, stageId);
      if (result.fa) {
        faRef.current = result.fa;
        onFaChange(result.fa);
        const confirmed = extractSelectedParticipantIds(result.fa);
        if (!isClosingFaRef.current) {
          adoptSelection(confirmed);
        }
        await cacheCurrentSnapshot(result.fa, confirmed);
      }
      await refreshPendingState();

      if (result.conflicts > 0) {
        onSyncNotice?.(
          "Hay conflictos de sincronización en el FA. Revisa la selección antes de cerrar."
        );
      }

      return result;
    } finally {
      syncInFlightRef.current = false;
      setIsSyncing(false);
    }
  }, [adoptSelection, cacheCurrentSnapshot, onFaChange, onSyncNotice, refreshPendingState, stageId, userId]);

  useEffect(() => {
    if (connectivityState !== "ONLINE" || !userId || pendingCount === 0) return;
    void syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al recuperar ONLINE
  }, [connectivityState]);

  const rememberServerFa = useCallback(
    async (nextFa: FaState) => {
      const selectedParticipantIds = extractSelectedParticipantIds(nextFa);
      await cacheCurrentSnapshot(nextFa, selectedParticipantIds);
      await refreshPendingState();
    },
    [cacheCurrentSnapshot, refreshPendingState]
  );

  const loadFromOfflineCache = useCallback(
    async (
      overrideUserId?: string
    ): Promise<{
      fa: FaState;
      selectedParticipantIds: string[];
    } | null> => {
      const effectiveUserId = overrideUserId ?? userId;
      if (!effectiveUserId) return null;
      const trusted = await getTrustedOfflineDevice();
      if (!trusted || trusted.userId !== effectiveUserId) return null;

      const snapshot = await readFaStageSnapshot(effectiveUserId, stageId);
      if (!snapshot) return null;

      adoptSelection(snapshot.selectedParticipantIds);
      await refreshPendingState();
      return snapshot;
    },
    [adoptSelection, refreshPendingState, stageId, userId]
  );

  const toggleSelection = useCallback(
    (participantId: string) => {
      const currentFa = faRef.current;
      if (
        !userId ||
        !currentFa ||
        isClosingFaRef.current ||
        summaryStatus !== "JUDGING_STARTED" ||
        currentFa.form.status !== "STARTED"
      ) {
        return;
      }

      const current = localSelectionRef.current;
      const isSelected = current.includes(participantId);
      const next = isSelected
        ? current.filter((id) => id !== participantId)
        : [...current, participantId];

      if (next.length > 10) return;

      const version = selectionVersionRef.current + 1;
      selectionVersionRef.current = version;
      adoptSelection(next);

      void (async () => {
        try {
          const payload: FaSelectionMutationPayload = {
            selectedParticipantIds: next,
            selectedTrackPositions: currentFa.participants
              .filter((participant) => next.includes(participant.id))
              .map((participant) => participant.trackPosition)
              .sort((left, right) => left - right),
          };

          await queueOfflineMutation({
            deduplicationKey: `FA_FORM:${stageId}:${currentFa.form.id}`,
            userId,
            stageId,
            aggregateType: "FA_FORM",
            aggregateId: currentFa.form.id,
            operationType: "UPDATE_FA_SELECTION",
            baseRevision: currentFa.form.revision,
            payload,
          });
          await cacheCurrentSnapshot(currentFa, next);
          await refreshPendingState();

          if (connectivityState === "ONLINE") {
            if (syncDebounceTimerRef.current) {
              clearTimeout(syncDebounceTimerRef.current);
            }
            syncDebounceTimerRef.current = setTimeout(() => {
              syncDebounceTimerRef.current = null;
              void syncNow();
            }, FA_SYNC_DEBOUNCE_MS);
          }
        } catch (error) {
          if (selectionVersionRef.current !== version) return;

          const message =
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "No se pudo guardar la selección FA.";
          onUpdateError?.(message);
        }
      })();
    },
    [
      adoptSelection,
      cacheCurrentSnapshot,
      connectivityState,
      onUpdateError,
      refreshPendingState,
      stageId,
      summaryStatus,
      syncNow,
      userId,
    ]
  );

  const beginClose = useCallback(() => {
    isClosingFaRef.current = true;
  }, []);

  const endClose = useCallback(() => {
    isClosingFaRef.current = false;
  }, []);

  const selectedIds = useMemo(() => new Set(selectedIdsLocal), [selectedIdsLocal]);
  const selectedCount = useMemo(() => {
    if (!fa) return 0;
    return fa.form.status === "STARTED" ? selectedIds.size : fa.form.selectedCount;
  }, [fa, selectedIds]);

  return {
    selectedIds,
    selectedIdsLocal,
    selectedCount,
    localSelectionRef,
    pendingCount,
    hasBlockingPending,
    isSyncing,
    isClosingFaRef,
    toggleSelection,
    syncNow,
    loadFromOfflineCache,
    rememberServerFa,
    beginClose,
    endClose,
    refreshPendingState,
  };
}
