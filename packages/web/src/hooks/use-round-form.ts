import { useCallback, useEffect, useRef, useState } from "react";

import { stagedFlowService } from "@/services/staged-flow.service";
import type { RoundState } from "@/types/staged-flow";

type FormPayload = {
  selectedParticipantIds?: string[];
  positions?: Array<{ participantId: string; position: number }>;
  desertedPositions?: number[];
};

type UseRoundFormParams = {
  stageId: string;
  userId: string | null;
  round: RoundState;
  onRoundChange: (round: RoundState) => void;
  onSyncNotice?: (message: string) => void;
};

/**
 * Borrador de la tarjeta de ronda exclusivamente en memoria.
 *
 * Las selecciones y los puestos se envían al backend únicamente al cerrar.
 * Una recarga descarta el borrador y restaura el último estado confirmado.
 */
export function useRoundForm({
  stageId,
  userId,
  round,
  onRoundChange,
}: UseRoundFormParams) {
  const [hasLocalDraft, setHasLocalDraft] = useState(false);
  const roundRef = useRef(round);
  const isClosingRef = useRef(false);
  const hasLocalDraftRef = useRef(false);
  const formKeyRef = useRef<string | null>(
    round.form ? `${round.round.id}:${round.form.id}` : null
  );

  useEffect(() => {
    const formKey = round.form ? `${round.round.id}:${round.form.id}` : null;
    const formChanged = formKeyRef.current !== formKey;
    const formClosed = round.form?.status === "CLOSED";

    if (formChanged || formClosed) {
      formKeyRef.current = formKey;
      hasLocalDraftRef.current = false;
      setHasLocalDraft(false);
      roundRef.current = round;
      return;
    }

    if (!hasLocalDraftRef.current && !isClosingRef.current) {
      roundRef.current = round;
      return;
    }

    if (hasLocalDraftRef.current) {
      const draftById = new Map(
        roundRef.current.participants.map((participant) => [participant.id, participant])
      );
      roundRef.current = {
        ...round,
        participants: round.participants.map((participant) => {
          const draft = draftById.get(participant.id);
          if (!draft || participant.status !== "ELIGIBLE") return participant;
          return {
            ...participant,
            selected: draft.selected,
            position: draft.position,
          };
        }),
      };
    }
  }, [round]);

  const queueFormSnapshot = useCallback(
    (payload: FormPayload) => {
      const current = roundRef.current;
      if (!userId || !current.form || isClosingRef.current) return;

      const optimistic: RoundState = {
        ...current,
        participants:
          payload.selectedParticipantIds != null
            ? current.participants.map((participant) => ({
                ...participant,
                selected: payload.selectedParticipantIds!.includes(participant.id),
                position: null,
              }))
            : current.participants.map((participant) => ({
                ...participant,
                selected: false,
                position:
                  payload.positions?.find((row) => row.participantId === participant.id)?.position ??
                  null,
              })),
        form: {
          ...current.form,
          desertedPositions: payload.desertedPositions ?? current.form.desertedPositions,
        },
      };

      hasLocalDraftRef.current = true;
      setHasLocalDraft(true);
      roundRef.current = optimistic;
      onRoundChange(optimistic);
    },
    [onRoundChange, userId]
  );

  const mergeServerMetadataWithDraft = useCallback((serverRound: RoundState): RoundState => {
    if (!hasLocalDraftRef.current) return serverRound;
    const draftById = new Map(
      roundRef.current.participants.map((participant) => [participant.id, participant])
    );
    return {
      ...serverRound,
      participants: serverRound.participants.map((participant) => {
        const draft = draftById.get(participant.id);
        if (!draft || participant.status !== "ELIGIBLE") return participant;
        return {
          ...participant,
          selected: draft.selected,
          position: draft.position,
        };
      }),
    };
  }, []);

  const queueNote = useCallback(
    async (participantId: string, note: string | null) => {
      const response = await stagedFlowService.updateRoundEntryNote(stageId, participantId, note);
      if (!response.data) throw new Error("La API no confirmó el guardado de la nota.");
      const merged = mergeServerMetadataWithDraft(response.data);
      roundRef.current = merged;
      onRoundChange(merged);
    },
    [mergeServerMetadataWithDraft, onRoundChange, stageId]
  );

  const queueReminders = useCallback(
    async (
      participantId: string,
      reminders: Array<{ reminderId: string; effect: "SUMA" | "RESTA" }>
    ) => {
      const response = await stagedFlowService.updateRoundEntryReminders(
        stageId,
        participantId,
        reminders
      );
      if (!response.data) throw new Error("La API no confirmó los recordatorios.");
      const merged = mergeServerMetadataWithDraft(response.data);
      roundRef.current = merged;
      onRoundChange(merged);
    },
    [mergeServerMetadataWithDraft, onRoundChange, stageId]
  );

  const buildCloseBody = useCallback(() => {
    const current = roundRef.current;
    if (!current.form) return null;
    const common = {
      roundId: current.round.id,
      tieBlockIdentity: current.round.tieBlockIdentity || "STANDARD",
      expectedRevision: current.form.revision,
    };
    if (current.round.roundType === "F1") {
      return {
        ...common,
        selectedParticipantIds: current.participants
          .filter((participant) => participant.selected && participant.status === "ELIGIBLE")
          .map((participant) => participant.id),
      };
    }
    return {
      ...common,
      positions: current.participants
        .filter((participant) => participant.status === "ELIGIBLE" && participant.position != null)
        .map((participant) => ({
          participantId: participant.id,
          position: participant.position as number,
        })),
      desertedPositions: current.form.desertedPositions,
    };
  }, []);

  return {
    pendingCount: 0,
    hasBlockingPending: false,
    hasLocalDraft,
    isSyncing: false,
    flushPendingChanges: useCallback(async () => ({
      synced: 0,
      conflicts: 0,
      failed: 0,
      round: roundRef.current,
    }), []),
    queueFormSnapshot,
    queueNote,
    queueReminders,
    beginClose: useCallback(() => {
      isClosingRef.current = true;
    }, []),
    endClose: useCallback(() => {
      isClosingRef.current = false;
    }, []),
    buildCloseBody,
  };
}
