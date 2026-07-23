import { ApiError } from "../services/api.service";
import { stagedFlowService } from "../services/staged-flow.service";
import type { FaState, RoundState, VeterinaryCheck, VeterinaryCheckStatus } from "../types/staged-flow";
import { checkPegasusConnectivity } from "./connectivity";
import type { OfflineMutationEnvelope } from "./mutation-types";
import {
  confirmOfflineMutation,
  listPendingMutationsForStage,
  markMutationStatus,
  recoverStaleSyncingMutations,
} from "./offline-repository";
import type { OfflineMutation } from "./schema";

export type VetCheckMutationPayload = {
  fairEntryId: string;
  status: VeterinaryCheckStatus;
  notes?: string | null;
};

export type FaSelectionMutationPayload = {
  selectedParticipantIds: string[];
};

export type RoundFormMutationPayload = {
  roundId: string;
  tieBlockIdentity: string;
  selectedParticipantIds?: string[];
  positions?: Array<{ participantId: string; position: number }>;
  desertedPositions?: number[];
};

export type RoundNoteMutationPayload = {
  roundId: string;
  tieBlockIdentity: string;
  participantId: string;
  note: string | null;
};

export type RoundRemindersMutationPayload = {
  roundId: string;
  tieBlockIdentity: string;
  participantId: string;
  reminders: Array<{ reminderId: string; effect: "SUMA" | "RESTA" }>;
};

export type SyncVetStageResult = {
  synced: number;
  conflicts: number;
  failed: number;
  checks: VeterinaryCheck[] | null;
};

export type SyncFaStageResult = {
  synced: number;
  conflicts: number;
  failed: number;
  fa: FaState | null;
};

export type SyncRoundStageResult = {
  synced: number;
  conflicts: number;
  failed: number;
  round: RoundState | null;
};

type RevisionConflictDetails = {
  currentRevision?: number;
  resolution?: "RELOAD_REQUIRED" | "CAN_REAPPLY_LOCAL_DRAFT";
};

function isVetPayload(payload: unknown): payload is VetCheckMutationPayload {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as VetCheckMutationPayload;
  return typeof value.fairEntryId === "string" && typeof value.status === "string";
}

function isFaPayload(payload: unknown): payload is FaSelectionMutationPayload {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as FaSelectionMutationPayload;
  return Array.isArray(value.selectedParticipantIds);
}

async function syncVeterinaryMutation(
  mutation: OfflineMutation<VetCheckMutationPayload>
): Promise<{ checks: VeterinaryCheck[]; revision: number }> {
  if (!isVetPayload(mutation.payload)) {
    throw new ApiError("Payload veterinario inválido.", {
      status: 422,
      code: "OFFLINE_PAYLOAD_INVALID",
    });
  }

  const envelope: OfflineMutationEnvelope<{
    status: VeterinaryCheckStatus;
    notes?: string | null;
  }> = {
    operationId: mutation.operationId,
    baseRevision: mutation.baseRevision,
    clientUpdatedAt: mutation.clientUpdatedAt,
    payload: {
      status: mutation.payload.status,
      notes: mutation.payload.notes ?? null,
    },
  };

  const response = await stagedFlowService.updateVeterinaryCheck(
    mutation.stageId,
    mutation.payload.fairEntryId,
    envelope
  );

  const checks = response.data ?? [];
  const revision =
    response.sync?.revision ??
    checks.find((check) => check.id === mutation.aggregateId)?.revision ??
    mutation.baseRevision + 1;

  await confirmOfflineMutation({
    operationId: mutation.operationId,
    userId: mutation.userId,
    stageId: mutation.stageId,
    aggregateId: mutation.aggregateId,
    appliedRevision: revision,
    responsePayload: checks,
    confirmedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return { checks, revision };
}

async function handleSyncError(
  mutation: OfflineMutation,
  error: unknown
): Promise<"conflict" | "failed" | "session"> {
  const apiError = error instanceof ApiError ? error : null;
  const code = apiError?.code ?? "SYNC_FAILED";
  const message = apiError?.message ?? (error instanceof Error ? error.message : "Error de sincronización.");

  if (code === "REVISION_CONFLICT") {
    const details = apiError?.details as RevisionConflictDetails | undefined;
    await markMutationStatus(mutation.operationId, {
      status: "CONFLICT",
      lastErrorCode: code,
      lastErrorMessage: message,
      lastErrorDetails: details ?? null,
    });
    return "conflict";
  }

  if (code === "STAGE_ADVANCED" || code === "FORM_CLOSED" || code === "ROUND_REPLACED") {
    await markMutationStatus(mutation.operationId, {
      status: "CONFLICT",
      lastErrorCode: code,
      lastErrorMessage: message,
      lastErrorDetails: apiError?.details ?? null,
    });
    return "conflict";
  }

  if (apiError?.status === 401) {
    await markMutationStatus(mutation.operationId, {
      status: "PENDING",
      lastErrorCode: "SESSION_EXPIRED",
      lastErrorMessage: message,
      lastErrorDetails: null,
    });
    return "session";
  }

  const retryable = apiError?.status == null || apiError.status >= 500;
  await markMutationStatus(mutation.operationId, {
    status: retryable ? "PENDING" : "FAILED",
    lastErrorCode: code,
    lastErrorMessage: message,
    lastErrorDetails: apiError?.details ?? null,
    nextRetryAt: retryable ? new Date(Date.now() + 5_000).toISOString() : null,
  });
  return "failed";
}

export async function syncVeterinaryStage(
  userId: string,
  stageId: string
): Promise<SyncVetStageResult> {
  await recoverStaleSyncingMutations(userId, stageId);
  const online = await checkPegasusConnectivity();
  if (!online) {
    return { synced: 0, conflicts: 0, failed: 0, checks: null };
  }

  let synced = 0;
  let conflicts = 0;
  let failed = 0;
  let latestChecks: VeterinaryCheck[] | null = null;

  // Vacía la cola aunque entren mutaciones nuevas mientras otra está SYNCING.
  const maxPasses = 20;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const pending = await listPendingMutationsForStage(userId, stageId);
    const veterinaryPending = pending.filter((mutation) => mutation.aggregateType === "VET_CHECK");
    if (veterinaryPending.length === 0) break;

    let stoppedForSession = false;
    for (const mutation of veterinaryPending) {
      await markMutationStatus(mutation.operationId, {
        status: "SYNCING",
        attempts: mutation.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
        nextRetryAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastErrorDetails: null,
      });

      try {
        const result = await syncVeterinaryMutation(
          mutation as OfflineMutation<VetCheckMutationPayload>
        );
        latestChecks = result.checks;
        synced += 1;
      } catch (error) {
        const outcome = await handleSyncError(mutation, error);
        if (outcome === "conflict") conflicts += 1;
        else failed += 1;
        if (outcome === "session") {
          stoppedForSession = true;
          break;
        }
      }
    }

    if (stoppedForSession || conflicts > 0 || failed > 0) break;
  }

  return { synced, conflicts, failed, checks: latestChecks };
}

async function syncFaMutation(
  mutation: OfflineMutation<FaSelectionMutationPayload>
): Promise<{ fa: FaState; revision: number }> {
  if (!isFaPayload(mutation.payload)) {
    throw new ApiError("Payload FA inválido.", {
      status: 422,
      code: "OFFLINE_PAYLOAD_INVALID",
    });
  }

  const envelope: OfflineMutationEnvelope<{ selectedParticipantIds: string[] }> = {
    operationId: mutation.operationId,
    baseRevision: mutation.baseRevision,
    clientUpdatedAt: mutation.clientUpdatedAt,
    payload: {
      selectedParticipantIds: mutation.payload.selectedParticipantIds,
    },
  };

  const response = await stagedFlowService.updateFaDecisions(mutation.stageId, envelope);
  const fa = response.data;
  if (!fa) {
    throw new ApiError("La API no devolvió el estado FA.", {
      status: 500,
      code: "SYNC_FAILED",
    });
  }

  const revision = response.sync?.revision ?? fa.form.revision;

  await confirmOfflineMutation({
    operationId: mutation.operationId,
    userId: mutation.userId,
    stageId: mutation.stageId,
    aggregateId: mutation.aggregateId,
    appliedRevision: revision,
    responsePayload: fa,
    confirmedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return { fa, revision };
}

export async function syncFaStage(userId: string, stageId: string): Promise<SyncFaStageResult> {
  await recoverStaleSyncingMutations(userId, stageId);
  const online = await checkPegasusConnectivity();
  if (!online) {
    return { synced: 0, conflicts: 0, failed: 0, fa: null };
  }

  let synced = 0;
  let conflicts = 0;
  let failed = 0;
  let latestFa: FaState | null = null;

  // Vacía la cola aunque entren mutaciones nuevas mientras otra está SYNCING.
  const maxPasses = 20;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const pending = await listPendingMutationsForStage(userId, stageId);
    const faPending = pending.filter((mutation) => mutation.aggregateType === "FA_FORM");
    if (faPending.length === 0) break;

    let stoppedForSession = false;
    for (const mutation of faPending) {
      await markMutationStatus(mutation.operationId, {
        status: "SYNCING",
        attempts: mutation.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
        nextRetryAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastErrorDetails: null,
      });

      try {
        const result = await syncFaMutation(mutation as OfflineMutation<FaSelectionMutationPayload>);
        latestFa = result.fa;
        synced += 1;
      } catch (error) {
        const outcome = await handleSyncError(mutation, error);
        if (outcome === "conflict") conflicts += 1;
        else failed += 1;
        if (outcome === "session") {
          stoppedForSession = true;
          break;
        }
      }
    }

    if (stoppedForSession || conflicts > 0 || failed > 0) break;
  }

  return { synced, conflicts, failed, fa: latestFa };
}

function isRoundFormPayload(payload: unknown): payload is RoundFormMutationPayload {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as RoundFormMutationPayload;
  return typeof value.roundId === "string" && typeof value.tieBlockIdentity === "string";
}

function isRoundNotePayload(payload: unknown): payload is RoundNoteMutationPayload {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as RoundNoteMutationPayload;
  return (
    typeof value.roundId === "string" &&
    typeof value.tieBlockIdentity === "string" &&
    typeof value.participantId === "string"
  );
}

function isRoundRemindersPayload(payload: unknown): payload is RoundRemindersMutationPayload {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as RoundRemindersMutationPayload;
  return (
    typeof value.roundId === "string" &&
    typeof value.tieBlockIdentity === "string" &&
    typeof value.participantId === "string" &&
    Array.isArray(value.reminders)
  );
}

async function syncRoundFormMutation(
  mutation: OfflineMutation<RoundFormMutationPayload>
): Promise<{ round: RoundState; revision: number }> {
  if (!isRoundFormPayload(mutation.payload)) {
    throw new ApiError("Payload de ronda inválido.", {
      status: 422,
      code: "OFFLINE_PAYLOAD_INVALID",
    });
  }

  const envelope: OfflineMutationEnvelope<RoundFormMutationPayload> = {
    operationId: mutation.operationId,
    baseRevision: mutation.baseRevision,
    clientUpdatedAt: mutation.clientUpdatedAt,
    payload: mutation.payload,
  };

  const response = await stagedFlowService.updateRoundForm(mutation.stageId, envelope);
  const round = response.data;
  if (!round?.form) {
    throw new ApiError("La API no devolvió el estado de ronda.", {
      status: 500,
      code: "SYNC_FAILED",
    });
  }

  const revision = response.sync?.revision ?? round.form.revision;
  await confirmOfflineMutation({
    operationId: mutation.operationId,
    userId: mutation.userId,
    stageId: mutation.stageId,
    aggregateId: mutation.aggregateId,
    appliedRevision: revision,
    responsePayload: round,
    confirmedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return { round, revision };
}

async function syncRoundNoteMutation(
  mutation: OfflineMutation<RoundNoteMutationPayload>
): Promise<{ round: RoundState; revision: number }> {
  if (!isRoundNotePayload(mutation.payload)) {
    throw new ApiError("Payload de nota inválido.", {
      status: 422,
      code: "OFFLINE_PAYLOAD_INVALID",
    });
  }

  const envelope: OfflineMutationEnvelope<{
    note: string | null;
    roundId: string;
    tieBlockIdentity: string;
  }> = {
    operationId: mutation.operationId,
    baseRevision: mutation.baseRevision,
    clientUpdatedAt: mutation.clientUpdatedAt,
    payload: {
      note: mutation.payload.note,
      roundId: mutation.payload.roundId,
      tieBlockIdentity: mutation.payload.tieBlockIdentity,
    },
  };

  const response = await stagedFlowService.updateRoundEntryNote(
    mutation.stageId,
    mutation.payload.participantId,
    envelope
  );
  const round = response.data;
  if (!round?.form) {
    throw new ApiError("La API no devolvió el estado de ronda.", {
      status: 500,
      code: "SYNC_FAILED",
    });
  }

  const revision = response.sync?.revision ?? round.form.revision;
  await confirmOfflineMutation({
    operationId: mutation.operationId,
    userId: mutation.userId,
    stageId: mutation.stageId,
    aggregateId: mutation.aggregateId,
    appliedRevision: revision,
    responsePayload: round,
    confirmedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return { round, revision };
}

async function syncRoundRemindersMutation(
  mutation: OfflineMutation<RoundRemindersMutationPayload>
): Promise<{ round: RoundState; revision: number }> {
  if (!isRoundRemindersPayload(mutation.payload)) {
    throw new ApiError("Payload de recordatorios inválido.", {
      status: 422,
      code: "OFFLINE_PAYLOAD_INVALID",
    });
  }

  const envelope: OfflineMutationEnvelope<{
    reminders: Array<{ reminderId: string; effect: "SUMA" | "RESTA" }>;
    roundId: string;
    tieBlockIdentity: string;
  }> = {
    operationId: mutation.operationId,
    baseRevision: mutation.baseRevision,
    clientUpdatedAt: mutation.clientUpdatedAt,
    payload: {
      reminders: mutation.payload.reminders,
      roundId: mutation.payload.roundId,
      tieBlockIdentity: mutation.payload.tieBlockIdentity,
    },
  };

  const response = await stagedFlowService.updateRoundEntryReminders(
    mutation.stageId,
    mutation.payload.participantId,
    envelope
  );
  const round = response.data;
  if (!round?.form) {
    throw new ApiError("La API no devolvió el estado de ronda.", {
      status: 500,
      code: "SYNC_FAILED",
    });
  }

  const revision = response.sync?.revision ?? round.form.revision;
  await confirmOfflineMutation({
    operationId: mutation.operationId,
    userId: mutation.userId,
    stageId: mutation.stageId,
    aggregateId: mutation.aggregateId,
    appliedRevision: revision,
    responsePayload: round,
    confirmedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return { round, revision };
}

export async function syncRoundStage(userId: string, stageId: string): Promise<SyncRoundStageResult> {
  await recoverStaleSyncingMutations(userId, stageId);
  const online = await checkPegasusConnectivity();
  if (!online) {
    return { synced: 0, conflicts: 0, failed: 0, round: null };
  }

  let synced = 0;
  let conflicts = 0;
  let failed = 0;
  let latestRound: RoundState | null = null;

  const aggregateOrder = ["ROUND_FORM", "ROUND_NOTE", "ROUND_REMINDERS"] as const;
  const maxPasses = 20;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const pending = await listPendingMutationsForStage(userId, stageId);
    const roundPending = pending
      .filter((mutation) =>
        aggregateOrder.includes(mutation.aggregateType as (typeof aggregateOrder)[number])
      )
      .sort((left, right) => {
        const leftRank = aggregateOrder.indexOf(left.aggregateType as (typeof aggregateOrder)[number]);
        const rightRank = aggregateOrder.indexOf(right.aggregateType as (typeof aggregateOrder)[number]);
        if (leftRank !== rightRank) return leftRank - rightRank;
        return left.createdAt.localeCompare(right.createdAt);
      });

    if (roundPending.length === 0) break;

    let stoppedForSession = false;
    for (const mutation of roundPending) {
      await markMutationStatus(mutation.operationId, {
        status: "SYNCING",
        attempts: mutation.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
        nextRetryAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastErrorDetails: null,
      });

      try {
        if (mutation.aggregateType === "ROUND_FORM") {
          const result = await syncRoundFormMutation(
            mutation as OfflineMutation<RoundFormMutationPayload>
          );
          latestRound = result.round;
        } else if (mutation.aggregateType === "ROUND_NOTE") {
          const result = await syncRoundNoteMutation(
            mutation as OfflineMutation<RoundNoteMutationPayload>
          );
          latestRound = result.round;
        } else {
          const result = await syncRoundRemindersMutation(
            mutation as OfflineMutation<RoundRemindersMutationPayload>
          );
          latestRound = result.round;
        }
        synced += 1;
      } catch (error) {
        const outcome = await handleSyncError(mutation, error);
        if (outcome === "conflict") conflicts += 1;
        else failed += 1;
        if (outcome === "session") {
          stoppedForSession = true;
          break;
        }
      }
    }

    if (stoppedForSession || conflicts > 0 || failed > 0) break;
  }

  return { synced, conflicts, failed, round: latestRound };
}
