import { useCallback, useRef, useState } from "react";

import { stagedFlowService } from "@/services/staged-flow.service";
import type { VeterinaryCheck, VeterinaryCheckStatus } from "@/types/staged-flow";

type UseVeterinaryChecksParams = {
  stageId: string;
  onUpdateError?: () => void;
};

export function useVeterinaryChecks({ stageId, onUpdateError }: UseVeterinaryChecksParams) {
  const [checks, setChecks] = useState<VeterinaryCheck[]>([]);
  const [updatingVetByEntryId, setUpdatingVetByEntryId] = useState<Record<string, boolean>>({});
  const requestVersionByEntryRef = useRef<Record<string, number>>({});

  const handleVetCheckUpdate = useCallback(
    async (fairEntryId: string, status: VeterinaryCheckStatus) => {
      let previousStatus: VeterinaryCheckStatus | undefined;

      const nextVersion = (requestVersionByEntryRef.current[fairEntryId] ?? 0) + 1;
      requestVersionByEntryRef.current[fairEntryId] = nextVersion;

      setChecks((prev) => {
        previousStatus = prev.find((check) => check.fairEntryId === fairEntryId)?.status;
        if (previousStatus === status) return prev;
        return prev.map((check) => (check.fairEntryId === fairEntryId ? { ...check, status } : check));
      });

      setUpdatingVetByEntryId((prev) => ({ ...prev, [fairEntryId]: true }));

      try {
        const response = await stagedFlowService.updateVeterinaryCheck(stageId, fairEntryId, { status });

        if (requestVersionByEntryRef.current[fairEntryId] !== nextVersion) return;

        const updatedCheck = response.data?.find((check) => check.fairEntryId === fairEntryId);
        if (!updatedCheck) return;

        setChecks((prev) =>
          prev.map((check) => (check.fairEntryId === fairEntryId ? updatedCheck : check))
        );
      } catch {
        if (requestVersionByEntryRef.current[fairEntryId] !== nextVersion) return;

        const rollbackStatus = previousStatus;
        if (rollbackStatus !== undefined) {
          setChecks((prev) =>
            prev.map((check) => (check.fairEntryId === fairEntryId ? { ...check, status: rollbackStatus } : check))
          );
        }
        onUpdateError?.();
      } finally {
        if (requestVersionByEntryRef.current[fairEntryId] === nextVersion) {
          setUpdatingVetByEntryId((prev) => ({ ...prev, [fairEntryId]: false }));
        }
      }
    },
    [onUpdateError, stageId]
  );

  return {
    checks,
    setChecks,
    updatingVetByEntryId,
    handleVetCheckUpdate,
  };
}
