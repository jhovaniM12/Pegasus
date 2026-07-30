import { useCallback, useEffect, useRef, useState } from "react";

import { stagedFlowService } from "@/services/staged-flow.service";
import type { RoundState } from "@/types/staged-flow";

const SAVE_DEBOUNCE_MS = 400;

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

export function useRoundForm({
  stageId,
  userId,
  round,
  onRoundChange,
}: UseRoundFormParams) {
  const [isSaving, setIsSaving] = useState(false);
  const [hasPendingSave, setHasPendingSave] = useState(false);
  const roundRef = useRef(round);
  const isClosingRef = useRef(false);
  const pendingPayloadRef = useRef<FormPayload | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveChainRef = useRef<Promise<RoundState | null>>(Promise.resolve(null));

  useEffect(() => {
    if (!pendingPayloadRef.current && !isClosingRef.current) {
      roundRef.current = round;
    }
  }, [round]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    []
  );

  const savePendingForm = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const payload = pendingPayloadRef.current;
    if (!userId || !payload) return null;
    pendingPayloadRef.current = null;
    setHasPendingSave(false);
    setIsSaving(true);

    const save = saveChainRef.current
      .catch(() => null)
      .then(async () => {
        const response = await stagedFlowService.updateRoundForm(stageId, payload);
        if (!response.data) throw new Error("La API no confirmó el guardado de la tarjeta.");
        roundRef.current = response.data;
        onRoundChange(response.data);
        return response.data;
      });
    saveChainRef.current = save;

    try {
      return await save;
    } finally {
      setIsSaving(false);
    }
  }, [onRoundChange, stageId, userId]);

  const queueFormSnapshot = useCallback(
    (payload: FormPayload) => {
      const current = roundRef.current;
      if (!userId || !current.form || isClosingRef.current) return;
      pendingPayloadRef.current = payload;
      setHasPendingSave(true);

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
      roundRef.current = optimistic;
      onRoundChange(optimistic);

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        void savePendingForm().catch(() => undefined);
      }, SAVE_DEBOUNCE_MS);
    },
    [onRoundChange, savePendingForm, userId]
  );

  const flushPendingChanges = useCallback(async () => {
    try {
      await savePendingForm();
      await saveChainRef.current;
      return { synced: 1, conflicts: 0, failed: 0, round: roundRef.current };
    } catch {
      return { synced: 0, conflicts: 0, failed: 1, round: roundRef.current };
    }
  }, [savePendingForm]);

  const queueNote = useCallback(
    async (participantId: string, note: string | null) => {
      const response = await stagedFlowService.updateRoundEntryNote(stageId, participantId, note);
      if (!response.data) throw new Error("La API no confirmó el guardado de la nota.");
      roundRef.current = response.data;
      onRoundChange(response.data);
    },
    [onRoundChange, stageId]
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
      roundRef.current = response.data;
      onRoundChange(response.data);
    },
    [onRoundChange, stageId]
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
    hasBlockingPending: hasPendingSave,
    isSyncing: isSaving,
    syncNow: savePendingForm,
    flushPendingChanges,
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
