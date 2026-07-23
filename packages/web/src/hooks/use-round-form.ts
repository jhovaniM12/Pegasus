import { useCallback, useEffect, useRef, useState } from "react";

import { useNetworkStatus } from "@/components/network-status";
import {
  countBlockingMutationsForStage,
  getTrustedOfflineDevice,
  hasBlockingMutationsForStage,
  queueOfflineMutation,
} from "@/offline/offline-repository";
import { cacheRoundStageSnapshot, readRoundStageSnapshot } from "@/offline/round-cache";
import {
  syncRoundStage,
  type RoundFormMutationPayload,
  type RoundNoteMutationPayload,
  type RoundRemindersMutationPayload,
} from "@/offline/sync-engine";
import type { RoundState } from "@/types/staged-flow";

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
  onSyncNotice,
}: UseRoundFormParams) {
  const { connectivityState } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [hasBlockingPending, setHasBlockingPending] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const roundRef = useRef(round);
  const syncInFlightRef = useRef(false);
  const isClosingRef = useRef(false);

  useEffect(() => {
    roundRef.current = round;
  }, [round]);

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

  useEffect(() => {
    void refreshPendingState();
  }, [refreshPendingState, round.form?.revision]);

  const rememberServerRound = useCallback(
    async (nextRound: RoundState) => {
      if (!userId) return;
      await cacheRoundStageSnapshot({ userId, round: nextRound });
      await refreshPendingState();
    },
    [refreshPendingState, userId]
  );

  const syncNow = useCallback(async () => {
    if (!userId || syncInFlightRef.current) {
      return { synced: 0, conflicts: 0, failed: 0, round: null as RoundState | null };
    }
    syncInFlightRef.current = true;
    setIsSyncing(true);
    try {
      const result = await syncRoundStage(userId, stageId);
      if (result.round) {
        roundRef.current = result.round;
        onRoundChange(result.round);
        await cacheRoundStageSnapshot({ userId, round: result.round });
      }
      await refreshPendingState();
      if (result.conflicts > 0) {
        onSyncNotice?.(
          "Hay conflictos de sincronización en la tarjeta. Revisa antes de cerrar."
        );
      }
      return result;
    } finally {
      syncInFlightRef.current = false;
      setIsSyncing(false);
    }
  }, [onRoundChange, onSyncNotice, refreshPendingState, stageId, userId]);

  useEffect(() => {
    if (connectivityState !== "ONLINE" || !userId || pendingCount === 0) return;
    void syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al recuperar ONLINE
  }, [connectivityState]);

  const loadFromOfflineCache = useCallback(
    async (overrideUserId?: string): Promise<RoundState | null> => {
      const effectiveUserId = overrideUserId ?? userId;
      if (!effectiveUserId) return null;
      const trusted = await getTrustedOfflineDevice();
      if (!trusted || trusted.userId !== effectiveUserId) return null;
      const snapshot = await readRoundStageSnapshot(effectiveUserId, stageId);
      if (!snapshot) return null;
      await refreshPendingState();
      return snapshot.round;
    },
    [refreshPendingState, stageId, userId]
  );

  const queueFormSnapshot = useCallback(
    async (payload: Omit<RoundFormMutationPayload, "roundId" | "tieBlockIdentity">) => {
      const current = roundRef.current;
      if (!userId || !current.form || isClosingRef.current) return;

      const fullPayload: RoundFormMutationPayload = {
        roundId: current.round.id,
        tieBlockIdentity: current.round.tieBlockIdentity || "STANDARD",
        ...payload,
      };

      await queueOfflineMutation({
        deduplicationKey: `ROUND_FORM:${stageId}:${current.round.id}:${fullPayload.tieBlockIdentity}:${current.form.id}`,
        userId,
        stageId,
        aggregateType: "ROUND_FORM",
        aggregateId: current.form.id,
        operationType: "UPDATE_ROUND_FORM",
        baseRevision: current.form.revision,
        payload: fullPayload,
      });

      const optimistic: RoundState = {
        ...current,
        participants:
          fullPayload.selectedParticipantIds != null
            ? current.participants.map((participant) => ({
                ...participant,
                selected: fullPayload.selectedParticipantIds!.includes(participant.id),
                position: null,
              }))
            : current.participants.map((participant) => ({
                ...participant,
                selected: false,
                position:
                  fullPayload.positions?.find((row) => row.participantId === participant.id)
                    ?.position ?? null,
              })),
        form: current.form
          ? {
              ...current.form,
              desertedPositions: fullPayload.desertedPositions ?? current.form.desertedPositions,
            }
          : null,
      };
      roundRef.current = optimistic;
      onRoundChange(optimistic);
      await cacheRoundStageSnapshot({ userId, round: optimistic });
      await refreshPendingState();

      if (connectivityState === "ONLINE") {
        await syncNow();
      }
    },
    [connectivityState, onRoundChange, refreshPendingState, stageId, syncNow, userId]
  );

  const queueNote = useCallback(
    async (participantId: string, note: string | null) => {
      const current = roundRef.current;
      if (!userId || !current.form || isClosingRef.current) return;

      const payload: RoundNoteMutationPayload = {
        roundId: current.round.id,
        tieBlockIdentity: current.round.tieBlockIdentity || "STANDARD",
        participantId,
        note,
      };

      await queueOfflineMutation({
        deduplicationKey: `ROUND_NOTE:${current.round.id}:${current.form.id}:${participantId}`,
        userId,
        stageId,
        aggregateType: "ROUND_NOTE",
        aggregateId: `${current.form.id}:${participantId}`,
        operationType: "UPDATE_ROUND_NOTE",
        baseRevision: current.form.revision,
        payload,
      });

      const optimistic: RoundState = {
        ...current,
        participants: current.participants.map((participant) =>
          participant.id === participantId ? { ...participant, privateNote: note } : participant
        ),
      };
      roundRef.current = optimistic;
      onRoundChange(optimistic);
      await cacheRoundStageSnapshot({ userId, round: optimistic });
      await refreshPendingState();
      if (connectivityState === "ONLINE") {
        await syncNow();
      }
    },
    [connectivityState, onRoundChange, refreshPendingState, stageId, syncNow, userId]
  );

  const queueReminders = useCallback(
    async (
      participantId: string,
      reminders: Array<{ reminderId: string; effect: "SUMA" | "RESTA" }>
    ) => {
      const current = roundRef.current;
      if (!userId || !current.form || isClosingRef.current) return;

      const payload: RoundRemindersMutationPayload = {
        roundId: current.round.id,
        tieBlockIdentity: current.round.tieBlockIdentity || "STANDARD",
        participantId,
        reminders,
      };

      await queueOfflineMutation({
        deduplicationKey: `ROUND_REMINDERS:${current.round.id}:${current.form.id}:${participantId}`,
        userId,
        stageId,
        aggregateType: "ROUND_REMINDERS",
        aggregateId: `${current.form.id}:${participantId}`,
        operationType: "UPDATE_ROUND_REMINDERS",
        baseRevision: current.form.revision,
        payload,
      });

      const reminderCatalog = new Map(
        current.availableReminders.map((item) => [item.id, item] as const)
      );
      const optimistic: RoundState = {
        ...current,
        participants: current.participants.map((participant) =>
          participant.id === participantId
            ? {
                ...participant,
                reminders: reminders.map((item) => {
                  const catalog = reminderCatalog.get(item.reminderId);
                  return {
                    reminderId: item.reminderId,
                    name: catalog?.name ?? "",
                    icon: catalog?.icon ?? "",
                    effect: item.effect,
                  };
                }),
              }
            : participant
        ),
      };
      roundRef.current = optimistic;
      onRoundChange(optimistic);
      await cacheRoundStageSnapshot({ userId, round: optimistic });
      await refreshPendingState();
      if (connectivityState === "ONLINE") {
        await syncNow();
      }
    },
    [connectivityState, onRoundChange, refreshPendingState, stageId, syncNow, userId]
  );

  const beginClose = useCallback(() => {
    isClosingRef.current = true;
  }, []);

  const endClose = useCallback(() => {
    isClosingRef.current = false;
  }, []);

  const buildCloseBody = useCallback(() => {
    const current = roundRef.current;
    if (!current.form) return null;

    if (current.round.roundType === "F1") {
      return {
        roundId: current.round.id,
        tieBlockIdentity: current.round.tieBlockIdentity || "STANDARD",
        expectedRevision: current.form.revision,
        selectedParticipantIds: current.participants
          .filter((participant) => participant.selected && participant.status === "ELIGIBLE")
          .map((participant) => participant.id),
      };
    }

    return {
      roundId: current.round.id,
      tieBlockIdentity: current.round.tieBlockIdentity || "STANDARD",
      expectedRevision: current.form.revision,
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
    pendingCount,
    hasBlockingPending,
    isSyncing,
    syncNow,
    queueFormSnapshot,
    queueNote,
    queueReminders,
    rememberServerRound,
    loadFromOfflineCache,
    beginClose,
    endClose,
    buildCloseBody,
    refreshPendingState,
  };
}
