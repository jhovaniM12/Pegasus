import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "@/services/api.service";
import { stagedFlowService } from "@/services/staged-flow.service";
import type { FaState, StagedCategory } from "@/types/staged-flow";

const SAVE_DEBOUNCE_MS = 400;

type UseFaSelectionParams = {
  stageId: string;
  userId: string | null;
  fa: FaState | null;
  summaryStatus: StagedCategory["status"] | undefined;
  onFaChange: (fa: FaState) => void;
  onUpdateError?: (message?: string) => void;
  onSyncNotice?: (message: string) => void;
};

function selectedParticipantIds(state: FaState): string[] {
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
}: UseFaSelectionParams) {
  const [selectedIdsLocal, setSelectedIdsLocal] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const localSelectionRef = useRef<string[]>([]);
  const faRef = useRef<FaState | null>(fa);
  const isClosingFaRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveChainRef = useRef<Promise<FaState | null>>(Promise.resolve(null));

  const adoptSelection = useCallback((ids: string[]) => {
    localSelectionRef.current = ids;
    setSelectedIdsLocal(ids);
  }, []);

  useEffect(() => {
    faRef.current = fa;
    if (fa && !isClosingFaRef.current) {
      adoptSelection(selectedParticipantIds(fa));
    } else if (!fa) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpia el estado al salir del formato FA
      adoptSelection([]);
      isClosingFaRef.current = false;
    }
  }, [adoptSelection, fa]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    []
  );

  const saveSelection = useCallback(async () => {
    if (!userId || !faRef.current) {
      return { synced: 0, conflicts: 0, failed: 0, fa: null as FaState | null };
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const ids = [...localSelectionRef.current];
    setIsSaving(true);
    const save = saveChainRef.current
      .catch(() => null)
      .then(async () => {
        const response = await stagedFlowService.updateFaDecisions(stageId, ids);
        if (!response.data) throw new Error("La API no confirmó la selección FA.");
        faRef.current = response.data;
        onFaChange(response.data);
        if (!isClosingFaRef.current && localSelectionRef.current.join("|") === ids.join("|")) {
          adoptSelection(selectedParticipantIds(response.data));
        }
        return response.data;
      });
    saveChainRef.current = save;

    try {
      const saved = await save;
      return { synced: 1, conflicts: 0, failed: 0, fa: saved };
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "No se pudo guardar la selección FA.";
      onUpdateError?.(message);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [adoptSelection, onFaChange, onUpdateError, stageId, userId]);

  const toggleSelection = useCallback(
    (participantId: string) => {
      const currentFa = faRef.current;
      if (
        !userId ||
        !currentFa ||
        isClosingFaRef.current ||
        summaryStatus !== "JUDGING_STARTED" ||
        currentFa.form.status !== "STARTED"
      ) return;

      const current = localSelectionRef.current;
      const next = current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId];
      if (next.length > 10) return;

      adoptSelection(next);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        void saveSelection().catch(() => undefined);
      }, SAVE_DEBOUNCE_MS);
    },
    [adoptSelection, saveSelection, summaryStatus, userId]
  );

  const selectedIds = useMemo(() => new Set(selectedIdsLocal), [selectedIdsLocal]);
  const selectedCount = fa?.form.status === "STARTED" ? selectedIds.size : fa?.form.selectedCount ?? 0;
  return {
    selectedIds,
    selectedIdsLocal,
    selectedCount,
    localSelectionRef,
    pendingCount: 0,
    hasBlockingPending: false,
    isSyncing: isSaving,
    isClosingFaRef,
    toggleSelection,
    syncNow: saveSelection,
    beginClose: useCallback(() => {
      isClosingFaRef.current = true;
    }, []),
    endClose: useCallback(() => {
      isClosingFaRef.current = false;
    }, []),
  };
}
