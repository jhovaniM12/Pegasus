import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/services/api.service";
import { stagedFlowService } from "@/services/staged-flow.service";
import type {
  DisqualificationReason,
  StagedCategory,
  VeterinaryCheck,
  VeterinaryCheckStatus,
} from "@/types/staged-flow";

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
  onUpdateError,
}: UseVeterinaryChecksParams) {
  const [checks, setChecksState] = useState<VeterinaryCheck[]>([]);
  const [updatingVetByEntryId, setUpdatingVetByEntryId] = useState<Record<string, boolean>>({});
  const checksRef = useRef<VeterinaryCheck[]>([]);

  useEffect(() => {
    checksRef.current = checks;
  }, [checks]);

  const setChecks = useCallback(async (nextChecks: VeterinaryCheck[], _summary?: StagedCategory) => {
    void _summary;
    checksRef.current = nextChecks;
    setChecksState(nextChecks);
  }, []);

  const handleVetCheckUpdate = useCallback(
    async (
      fairEntryId: string,
      status: VeterinaryCheckStatus,
      rejectionReason: DisqualificationReason | null = null
    ) => {
      if (!userId) return;
      const currentCheck = checksRef.current.find((check) => check.fairEntryId === fairEntryId);
      if (!currentCheck) return;

      const previous = checksRef.current;
      const optimistic = previous.map((check) =>
        check.fairEntryId === fairEntryId
          ? { ...check, status, rejectionReason: status === "REJECTED" ? rejectionReason : null }
          : check
      );
      checksRef.current = optimistic;
      setChecksState(optimistic);
      setUpdatingVetByEntryId((current) => ({ ...current, [fairEntryId]: true }));

      try {
        const response = await stagedFlowService.updateVeterinaryCheck(stageId, fairEntryId, {
          status,
          notes: currentCheck.notes,
          rejectionReasonId: status === "REJECTED" ? rejectionReason?.id ?? null : null,
        });
        if (!response.data) throw new Error("La API no confirmó el checkeo veterinario.");
        checksRef.current = response.data;
        setChecksState(response.data);
      } catch (error) {
        checksRef.current = previous;
        setChecksState(previous);
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "No se pudo guardar el checkeo veterinario.";
        onUpdateError?.(message);
      } finally {
        setUpdatingVetByEntryId((current) => ({ ...current, [fairEntryId]: false }));
      }
    },
    [onUpdateError, stageId, userId]
  );

  return {
    checks,
    setChecks,
    updatingVetByEntryId,
    handleVetCheckUpdate,
    pendingCount: 0,
    hasBlockingPending: false,
    isSyncing: false,
    syncNow: useCallback(async () => ({ synced: 0, conflicts: 0, failed: 0, checks: null }), []),
  };
}
