import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/api.service";
import { stagedFlowService } from "../services/staged-flow.service";
import { checkPegasusConnectivity } from "./connectivity";
import { closeOfflineDatabase, getOfflineDatabase } from "./db";
import {
  advancePendingBaseRevisions,
  listMutationsForUser,
  queueOfflineMutation,
} from "./offline-repository";
import { syncFaStage, syncRoundStage } from "./sync-engine";

vi.mock("../services/api.service", () => {
  class MockApiError extends Error {
    status: number | null = null;
    code: string | null = null;
    details: unknown;

    constructor(
      message: string,
      options: { status?: number | null; code?: string | null; details?: unknown } = {}
    ) {
      super(message);
      this.status = options.status ?? null;
      this.code = options.code ?? null;
      this.details = options.details;
    }
  }

  return { ApiError: MockApiError };
});

vi.mock("../services/staged-flow.service", () => ({
  stagedFlowService: {
    updateFaDecisions: vi.fn(),
    updateRoundForm: vi.fn(),
    updateRoundEntryNote: vi.fn(),
    updateRoundEntryReminders: vi.fn(),
  },
}));

vi.mock("./connectivity", () => ({
  checkPegasusConnectivity: vi.fn(),
}));

const connectivityMock = vi.mocked(checkPegasusConnectivity);
const updateFaDecisionsMock = vi.mocked(stagedFlowService.updateFaDecisions);
const updateRoundFormMock = vi.mocked(stagedFlowService.updateRoundForm);
const updateRoundEntryNoteMock = vi.mocked(stagedFlowService.updateRoundEntryNote);
const updateRoundEntryRemindersMock = vi.mocked(stagedFlowService.updateRoundEntryReminders);

const USER_ID = "11111111-1111-4111-8111-111111111111";
const STAGE_ID = "33333333-3333-4333-8333-333333333333";
const FORM_ID = "44444444-4444-4444-8444-444444444444";
const ROUND_ID = "55555555-5555-4555-8555-555555555555";
const PARTICIPANT_ID = "66666666-6666-4666-8666-666666666666";

afterEach(async () => {
  await getOfflineDatabase().delete();
  await closeOfflineDatabase();
  vi.clearAllMocks();
  updateFaDecisionsMock.mockReset();
  updateRoundFormMock.mockReset();
  updateRoundEntryNoteMock.mockReset();
  updateRoundEntryRemindersMock.mockReset();
  connectivityMock.mockReset();
});

function createFaMutation(selectedParticipantIds: string[], baseRevision = 3) {
  return queueOfflineMutation({
    deduplicationKey: `FA_FORM:${STAGE_ID}:${FORM_ID}`,
    userId: USER_ID,
    stageId: STAGE_ID,
    aggregateType: "FA_FORM" as const,
    aggregateId: FORM_ID,
    operationType: "UPDATE_FA_SELECTION",
    baseRevision,
    payload: { selectedParticipantIds },
  });
}

describe("sync engine recovery", () => {
  it("simula reinicio después de cerrar la PWA durante SYNCING", async () => {
    const mutation = await createFaMutation(["participant-1"]);
    await getOfflineDatabase().offlineMutations.update(mutation.operationId, {
      status: "SYNCING",
      lastAttemptAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      lastErrorDetails: null,
    });
    connectivityMock.mockResolvedValue(false);

    await syncFaStage(USER_ID, STAGE_ID);

    const recovered = await getOfflineDatabase().offlineMutations.get(mutation.operationId);
    expect(recovered).toMatchObject({
      operationId: mutation.operationId,
      status: "PENDING",
    });
  });

  it("conserva la operación PENDING cuando falla la red", async () => {
    const mutation = await createFaMutation(["participant-1"]);
    connectivityMock.mockResolvedValue(false);

    const result = await syncFaStage(USER_ID, STAGE_ID);

    expect(result).toEqual({ synced: 0, conflicts: 0, failed: 0, fa: null });
    const pending = await getOfflineDatabase().offlineMutations.get(mutation.operationId);
    expect(pending?.operationId).toBe(mutation.operationId);
    expect(pending?.status).toBe("PENDING");
  });
});

describe("sync engine revision chaining", () => {
  it("encadena baseRevision entre form, nota y recordatorios de la misma ronda", async () => {
    connectivityMock.mockResolvedValue(true);

    await queueOfflineMutation({
      deduplicationKey: `ROUND_FORM:${STAGE_ID}:${ROUND_ID}:STANDARD:${FORM_ID}`,
      userId: USER_ID,
      stageId: STAGE_ID,
      aggregateType: "ROUND_FORM",
      aggregateId: FORM_ID,
      operationType: "UPDATE_ROUND_FORM",
      baseRevision: 4,
      payload: {
        roundId: ROUND_ID,
        tieBlockIdentity: "STANDARD",
        positions: [{ participantId: PARTICIPANT_ID, position: 1 }],
      },
    });
    await queueOfflineMutation({
      deduplicationKey: `ROUND_NOTE:${ROUND_ID}:${FORM_ID}:${PARTICIPANT_ID}`,
      userId: USER_ID,
      stageId: STAGE_ID,
      aggregateType: "ROUND_NOTE",
      aggregateId: `${FORM_ID}:${PARTICIPANT_ID}`,
      operationType: "UPDATE_ROUND_NOTE",
      baseRevision: 4,
      payload: {
        roundId: ROUND_ID,
        tieBlockIdentity: "STANDARD",
        participantId: PARTICIPANT_ID,
        note: "Nota local",
      },
    });
    await queueOfflineMutation({
      deduplicationKey: `ROUND_REMINDERS:${ROUND_ID}:${FORM_ID}:${PARTICIPANT_ID}`,
      userId: USER_ID,
      stageId: STAGE_ID,
      aggregateType: "ROUND_REMINDERS",
      aggregateId: `${FORM_ID}:${PARTICIPANT_ID}`,
      operationType: "UPDATE_ROUND_REMINDERS",
      baseRevision: 4,
      payload: {
        roundId: ROUND_ID,
        tieBlockIdentity: "STANDARD",
        participantId: PARTICIPANT_ID,
        reminders: [],
      },
    });

    const roundState = (revision: number) => ({
      round: { id: ROUND_ID, tieBlockIdentity: "STANDARD" },
      form: { id: FORM_ID, revision },
      participants: [],
      availableReminders: [],
    });

    updateRoundFormMock.mockResolvedValue({
      data: roundState(5),
      sync: {
        operationId: "op-form",
        applied: true,
        duplicate: false,
        revision: 5,
        serverUpdatedAt: new Date().toISOString(),
      },
    } as never);
    updateRoundEntryNoteMock.mockResolvedValue({
      data: roundState(6),
      sync: {
        operationId: "op-note",
        applied: true,
        duplicate: false,
        revision: 6,
        serverUpdatedAt: new Date().toISOString(),
      },
    } as never);
    updateRoundEntryRemindersMock.mockResolvedValue({
      data: roundState(7),
      sync: {
        operationId: "op-reminders",
        applied: true,
        duplicate: false,
        revision: 7,
        serverUpdatedAt: new Date().toISOString(),
      },
    } as never);

    const result = await syncRoundStage(USER_ID, STAGE_ID);

    expect(result).toMatchObject({ synced: 3, conflicts: 0, failed: 0 });
    expect(updateRoundFormMock).toHaveBeenCalledWith(
      STAGE_ID,
      expect.objectContaining({ baseRevision: 4 })
    );
    expect(updateRoundEntryNoteMock).toHaveBeenCalledWith(
      STAGE_ID,
      PARTICIPANT_ID,
      expect.objectContaining({ baseRevision: 5 })
    );
    expect(updateRoundEntryRemindersMock).toHaveBeenCalledWith(
      STAGE_ID,
      PARTICIPANT_ID,
      expect.objectContaining({ baseRevision: 6 })
    );
    await expect(listMutationsForUser(USER_ID)).resolves.toHaveLength(0);
  });

  it("avanza la hermana PENDING tras sincronizar la mutación FA anterior", async () => {
    connectivityMock.mockResolvedValue(true);

    // Intención en vuelo + edición posterior (coalesce no toca SYNCING).
    const inFlight = await createFaMutation(["participant-1"], 3);
    await getOfflineDatabase().offlineMutations.update(inFlight.operationId, {
      status: "SYNCING",
      lastAttemptAt: new Date().toISOString(),
    });
    const sister = await createFaMutation(["participant-2"], 3);
    expect(sister.operationId).not.toBe(inFlight.operationId);

    // La primera vuelve a PENDING (recover/interrupt) y ambas se drenan en orden.
    await getOfflineDatabase().offlineMutations.update(inFlight.operationId, {
      status: "PENDING",
    });

    updateFaDecisionsMock
      .mockResolvedValueOnce({
        data: { form: { id: FORM_ID, revision: 4 }, participants: [] },
        sync: {
          operationId: inFlight.operationId,
          applied: true,
          duplicate: false,
          revision: 4,
          serverUpdatedAt: new Date().toISOString(),
        },
      } as never)
      .mockResolvedValueOnce({
        data: { form: { id: FORM_ID, revision: 5 }, participants: [] },
        sync: {
          operationId: sister.operationId,
          applied: true,
          duplicate: false,
          revision: 5,
          serverUpdatedAt: new Date().toISOString(),
        },
      } as never);

    const result = await syncFaStage(USER_ID, STAGE_ID);

    expect(result).toMatchObject({ synced: 2, conflicts: 0, failed: 0 });
    expect(updateFaDecisionsMock).toHaveBeenNthCalledWith(
      1,
      STAGE_ID,
      expect.objectContaining({ baseRevision: 3 })
    );
    expect(updateFaDecisionsMock).toHaveBeenNthCalledWith(
      2,
      STAGE_ID,
      expect.objectContaining({ baseRevision: 4 })
    );
  });

  it("advancePendingBaseRevisions solo actualiza PENDING del mismo agregado", async () => {
    const first = await createFaMutation(["participant-1"], 3);
    const otherCheck = await queueOfflineMutation({
      deduplicationKey: `VET_CHECK:${STAGE_ID}:other`,
      userId: USER_ID,
      stageId: STAGE_ID,
      aggregateType: "VET_CHECK",
      aggregateId: "other-check",
      operationType: "UPDATE_VET_CHECK",
      baseRevision: 3,
      payload: { fairEntryId: "entry-1", status: "PASSED" },
    });

    await advancePendingBaseRevisions({
      userId: USER_ID,
      stageId: STAGE_ID,
      appliedRevision: 4,
      match: (mutation) =>
        mutation.aggregateType === "FA_FORM" && mutation.aggregateId === FORM_ID,
    });

    await expect(getOfflineDatabase().offlineMutations.get(first.operationId)).resolves.toMatchObject({
      baseRevision: 4,
    });
    await expect(
      getOfflineDatabase().offlineMutations.get(otherCheck.operationId)
    ).resolves.toMatchObject({
      baseRevision: 3,
    });
  });

  it("reaplica una nota sobre la revisión actual cuando el servidor lo permite", async () => {
    connectivityMock.mockResolvedValue(true);

    await queueOfflineMutation({
      deduplicationKey: `ROUND_NOTE:${ROUND_ID}:${FORM_ID}:${PARTICIPANT_ID}`,
      userId: USER_ID,
      stageId: STAGE_ID,
      aggregateType: "ROUND_NOTE",
      aggregateId: `${FORM_ID}:${PARTICIPANT_ID}`,
      operationType: "UPDATE_ROUND_NOTE",
      baseRevision: 4,
      payload: {
        roundId: ROUND_ID,
        tieBlockIdentity: "STANDARD",
        participantId: PARTICIPANT_ID,
        note: "Nota persistente",
      },
    });

    updateRoundEntryNoteMock
      .mockRejectedValueOnce(
        new ApiError("Conflicto de revisión", {
          status: 409,
          code: "REVISION_CONFLICT",
          details: {
            currentRevision: 9,
            resolution: "CAN_REAPPLY_LOCAL_DRAFT",
          },
        })
      )
      .mockResolvedValueOnce({
        data: {
          round: { id: ROUND_ID, tieBlockIdentity: "STANDARD" },
          form: { id: FORM_ID, revision: 10 },
          participants: [],
          availableReminders: [],
        },
        sync: {
          operationId: "op-note",
          applied: true,
          duplicate: false,
          revision: 10,
          serverUpdatedAt: new Date().toISOString(),
        },
      } as never);

    const result = await syncRoundStage(USER_ID, STAGE_ID);

    expect(result).toMatchObject({ synced: 1, conflicts: 0, failed: 0 });
    expect(updateRoundEntryNoteMock).toHaveBeenNthCalledWith(
      1,
      STAGE_ID,
      PARTICIPANT_ID,
      expect.objectContaining({ baseRevision: 4 })
    );
    expect(updateRoundEntryNoteMock).toHaveBeenNthCalledWith(
      2,
      STAGE_ID,
      PARTICIPANT_ID,
      expect.objectContaining({ baseRevision: 9 })
    );
    await expect(listMutationsForUser(USER_ID)).resolves.toHaveLength(0);
  });

  it("marca CONFLICT si el servidor rechaza la revisión sin encadenar", async () => {
    connectivityMock.mockResolvedValue(true);

    await queueOfflineMutation({
      deduplicationKey: `ROUND_FORM:${STAGE_ID}:${ROUND_ID}:STANDARD:${FORM_ID}`,
      userId: USER_ID,
      stageId: STAGE_ID,
      aggregateType: "ROUND_FORM",
      aggregateId: FORM_ID,
      operationType: "UPDATE_ROUND_FORM",
      baseRevision: 4,
      payload: {
        roundId: ROUND_ID,
        tieBlockIdentity: "STANDARD",
        positions: [{ participantId: PARTICIPANT_ID, position: 1 }],
      },
    });
    await queueOfflineMutation({
      deduplicationKey: `ROUND_NOTE:${ROUND_ID}:${FORM_ID}:${PARTICIPANT_ID}`,
      userId: USER_ID,
      stageId: STAGE_ID,
      aggregateType: "ROUND_NOTE",
      aggregateId: `${FORM_ID}:${PARTICIPANT_ID}`,
      operationType: "UPDATE_ROUND_NOTE",
      baseRevision: 4,
      payload: {
        roundId: ROUND_ID,
        tieBlockIdentity: "STANDARD",
        participantId: PARTICIPANT_ID,
        note: "Nota",
      },
    });

    updateRoundFormMock.mockRejectedValue(
      new ApiError("Conflicto de revisión", {
        status: 409,
        code: "REVISION_CONFLICT",
        details: { currentRevision: 9 },
      })
    );

    const result = await syncRoundStage(USER_ID, STAGE_ID);

    expect(result).toMatchObject({ synced: 0, conflicts: 1, failed: 0 });
    expect(updateRoundEntryNoteMock).not.toHaveBeenCalled();
    const mutations = await listMutationsForUser(USER_ID);
    expect(mutations).toHaveLength(2);
    expect(mutations.find((item) => item.aggregateType === "ROUND_FORM")?.status).toBe("CONFLICT");
    expect(mutations.find((item) => item.aggregateType === "ROUND_NOTE")?.status).toBe("PENDING");
  });
});
