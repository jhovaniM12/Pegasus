import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FaState, StagedCategory } from "@/types/staged-flow";

type UseFaSelectionParams = {
  userId: string | null;
  fa: FaState | null;
  summaryStatus: StagedCategory["status"] | undefined;
};

function selectedParticipantIds(state: FaState): string[] {
  return state.participants
    .filter((participant) => participant.decision?.decision === "SELECTED")
    .map((participant) => participant.id);
}

/**
 * Borrador de selección FA exclusivamente en memoria.
 *
 * Los clics no escriben en el servidor. La página entrega `localSelectionRef`
 * al endpoint de cierre como fotografía definitiva. Una recarga crea un hook
 * nuevo y vuelve a la selección confirmada por el backend.
 */
export function useFaSelection({
  userId,
  fa,
  summaryStatus,
}: UseFaSelectionParams) {
  const [selectedIdsLocal, setSelectedIdsLocal] = useState<string[]>([]);
  const localSelectionRef = useRef<string[]>([]);
  const faRef = useRef<FaState | null>(fa);
  const isClosingFaRef = useRef(false);
  const isDirtyRef = useRef(false);
  const formKeyRef = useRef<string | null>(null);

  const adoptSelection = useCallback((ids: string[]) => {
    localSelectionRef.current = ids;
    setSelectedIdsLocal(ids);
  }, []);

  useEffect(() => {
    faRef.current = fa;
    if (!fa) {
      formKeyRef.current = null;
      isDirtyRef.current = false;
      isClosingFaRef.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpia el borrador al salir de FA
      adoptSelection([]);
      return;
    }

    const formKey = `${fa.form.id}:${fa.form.status}`;
    if (formKeyRef.current !== formKey) {
      formKeyRef.current = formKey;
      isDirtyRef.current = false;
      adoptSelection(selectedParticipantIds(fa));
      return;
    }

    if (isDirtyRef.current) {
      // Una actualización externa puede descalificar un ejemplar mientras el juez
      // conserva su borrador. Se retiran únicamente selecciones que dejaron de ser válidas.
      const eligibleIds = new Set(
        fa.participants
          .filter((participant) => participant.status === "ELIGIBLE")
          .map((participant) => participant.id)
      );
      const validSelection = localSelectionRef.current.filter((id) => eligibleIds.has(id));
      if (validSelection.length !== localSelectionRef.current.length) {
        adoptSelection(validSelection);
      }
    }
  }, [adoptSelection, fa]);

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

      isDirtyRef.current = true;
      adoptSelection(next);
    },
    [adoptSelection, summaryStatus, userId]
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
    isSyncing: false,
    isClosingFaRef,
    toggleSelection,
    beginClose: useCallback(() => {
      isClosingFaRef.current = true;
    }, []),
    endClose: useCallback(() => {
      isClosingFaRef.current = false;
    }, []),
  };
}
