import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { closeOfflineDatabase, getOfflineDatabase } from "./db";
import {
  advancePendingBaseRevisions,
  cacheOfflineContext,
  clearOfflineDataForUser,
  getOfflineContext,
  getTrustedOfflineDevice,
  hasBlockingMutationsForStage,
  listMutationsForUser,
  queueOfflineMutation,
  recoverStaleSyncingMutations,
  retryOfflineMutation,
  discardOfflineMutation,
  revokeOfflineDeviceTrust,
  setOfflinePageBootAtMsForTests,
  trustOfflineDevice,
} from "./offline-repository";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const STAGE_ID = "33333333-3333-4333-8333-333333333333";
const FORM_ID = "44444444-4444-4444-8444-444444444444";

afterEach(async () => {
  setOfflinePageBootAtMsForTests(Date.now());
  await getOfflineDatabase().delete();
  await closeOfflineDatabase();
});

function faMutationInput(
  selectedParticipantIds: string[],
  selectedTrackPositions: number[] = []
) {
  return {
    deduplicationKey: `FA_FORM:${STAGE_ID}:${FORM_ID}`,
    userId: USER_ID,
    stageId: STAGE_ID,
    aggregateType: "FA_FORM" as const,
    aggregateId: FORM_ID,
    operationType: "UPDATE_FA_SELECTION",
    baseRevision: 3,
    payload: { selectedParticipantIds, selectedTrackPositions },
  };
}

describe("offline repository", () => {
  it("coalesce múltiples cambios pendientes en una sola intención estable", async () => {
    const first = await queueOfflineMutation(faMutationInput(["participant-1"]));
    const second = await queueOfflineMutation(
      faMutationInput(["participant-1", "participant-2"], [1, 8])
    );

    expect(second.operationId).toBe(first.operationId);
    expect(second.baseRevision).toBe(3);
    expect(second.payload).toEqual({
      selectedParticipantIds: ["participant-1", "participant-2"],
      selectedTrackPositions: [1, 8],
    });
    await expect(listMutationsForUser(USER_ID)).resolves.toHaveLength(1);
  });

  it("conserva una intención posterior separada si otra ya está sincronizando", async () => {
    const syncing = await queueOfflineMutation(faMutationInput(["participant-1"]));
    await getOfflineDatabase().offlineMutations.update(syncing.operationId, {
      status: "SYNCING",
    });

    const pending = await queueOfflineMutation(faMutationInput(["participant-2"]));
    const mutations = await listMutationsForUser(USER_ID);

    expect(pending.operationId).not.toBe(syncing.operationId);
    expect(pending.baseRevision).toBe(3);
    expect(mutations.map((mutation) => mutation.status).sort()).toEqual([
      "PENDING",
      "SYNCING",
    ]);
  });

  it("avanza baseRevision de PENDING hermanas del mismo agregado", async () => {
    const syncing = await queueOfflineMutation(faMutationInput(["participant-1"]));
    await getOfflineDatabase().offlineMutations.update(syncing.operationId, {
      status: "SYNCING",
    });
    const pending = await queueOfflineMutation(faMutationInput(["participant-2"]));

    await expect(
      advancePendingBaseRevisions({
        userId: USER_ID,
        stageId: STAGE_ID,
        appliedRevision: 4,
        match: (mutation) =>
          mutation.aggregateType === "FA_FORM" && mutation.aggregateId === FORM_ID,
      })
    ).resolves.toBe(1);

    await expect(getOfflineDatabase().offlineMutations.get(pending.operationId)).resolves.toMatchObject({
      baseRevision: 4,
      status: "PENDING",
    });
    await expect(getOfflineDatabase().offlineMutations.get(syncing.operationId)).resolves.toMatchObject({
      baseRevision: 3,
      status: "SYNCING",
    });
  });

  it("particiona los contextos por usuario y categoría", async () => {
    const baseContext = {
      role: "JUDGE" as const,
      stageId: STAGE_ID,
      fairId: "fair-1",
      stageRevision: 1,
      stageStatus: "JUDGING_STARTED" as const,
      activeRoundId: null,
      activeTieBlockIdentity: null,
      payload: { participantIds: ["participant-1"] },
      lastServerSyncAt: new Date().toISOString(),
    };

    await cacheOfflineContext({ ...baseContext, userId: USER_ID });
    await cacheOfflineContext({
      ...baseContext,
      userId: OTHER_USER_ID,
      payload: { participantIds: ["participant-2"] },
    });

    await expect(getOfflineContext(USER_ID, STAGE_ID)).resolves.toMatchObject({
      userId: USER_ID,
      payload: { participantIds: ["participant-1"] },
    });
    await expect(getOfflineContext(OTHER_USER_ID, STAGE_ID)).resolves.toMatchObject({
      userId: OTHER_USER_ID,
      payload: { participantIds: ["participant-2"] },
    });
  });

  it("permite limpiar datos offline explícitamente sin dejar al usuario bloqueado", async () => {
    await queueOfflineMutation(faMutationInput([]));

    await expect(clearOfflineDataForUser(USER_ID)).resolves.toBeUndefined();
    await expect(listMutationsForUser(USER_ID)).resolves.toHaveLength(0);
  });

  it("recupera una operación SYNCING antigua conservando operationId", async () => {
    const mutation = await queueOfflineMutation(faMutationInput(["participant-1"]));
    const interruptedAt = new Date(Date.now() - 10 * 60_000).toISOString();
    await getOfflineDatabase().offlineMutations.update(mutation.operationId, {
      status: "SYNCING",
      lastAttemptAt: interruptedAt,
      lastErrorDetails: null,
    });

    await expect(recoverStaleSyncingMutations(USER_ID, STAGE_ID)).resolves.toBe(1);
    const recovered = await getOfflineDatabase().offlineMutations.get(mutation.operationId);
    expect(recovered?.operationId).toBe(mutation.operationId);
    expect(recovered?.status).toBe("PENDING");
    expect(recovered?.lastErrorCode).toBe("SYNC_INTERRUPTED");
  });

  it("no recupera una operación SYNCING reciente de esta misma página", async () => {
    setOfflinePageBootAtMsForTests(Date.now() - 60_000);
    const mutation = await queueOfflineMutation(faMutationInput(["participant-1"]));
    await getOfflineDatabase().offlineMutations.update(mutation.operationId, {
      status: "SYNCING",
      lastAttemptAt: new Date().toISOString(),
      lastErrorDetails: null,
    });

    await expect(recoverStaleSyncingMutations(USER_ID, STAGE_ID)).resolves.toBe(0);
    await expect(getOfflineDatabase().offlineMutations.get(mutation.operationId)).resolves.toMatchObject({
      operationId: mutation.operationId,
      status: "SYNCING",
    });
  });

  it("recupera de inmediato SYNCING de una página anterior tras reload", async () => {
    const bootAt = Date.now();
    setOfflinePageBootAtMsForTests(bootAt);
    const mutation = await queueOfflineMutation(faMutationInput(["participant-1"]));
    await getOfflineDatabase().offlineMutations.update(mutation.operationId, {
      status: "SYNCING",
      // Intento de la sesión/página anterior (antes del boot actual).
      lastAttemptAt: new Date(bootAt - 1_000).toISOString(),
      lastErrorDetails: null,
    });

    await expect(
      recoverStaleSyncingMutations(USER_ID, STAGE_ID, {
        // Aunque el margen por edad aún no haya vencido...
        staleAfterMs: 60_000,
        now: bootAt + 500,
      })
    ).resolves.toBe(1);

    await expect(getOfflineDatabase().offlineMutations.get(mutation.operationId)).resolves.toMatchObject({
      status: "PENDING",
      lastErrorCode: "SYNC_INTERRUPTED",
    });
  });

  it("permite reintentar o descartar explícitamente un conflicto", async () => {
    const mutation = await queueOfflineMutation(faMutationInput(["participant-1"]));
    await getOfflineDatabase().offlineMutations.update(mutation.operationId, {
      status: "CONFLICT",
      lastErrorCode: "REVISION_CONFLICT",
      lastErrorMessage: "conflicto",
      lastErrorDetails: { currentRevision: 9, currentState: { selected: [] } },
    });

    const retried = await retryOfflineMutation(mutation.operationId, { reapplyLocal: true });
    expect(retried).toMatchObject({
      operationId: mutation.operationId,
      status: "PENDING",
      baseRevision: 9,
    });

    await getOfflineDatabase().offlineMutations.update(mutation.operationId, { status: "CONFLICT" });
    await expect(discardOfflineMutation(mutation.operationId)).resolves.toBe(true);
    await expect(getOfflineDatabase().offlineMutations.get(mutation.operationId)).resolves.toBeUndefined();
    await expect(hasBlockingMutationsForStage(USER_ID, STAGE_ID)).resolves.toBe(false);
  });

  it("vincula el acceso offline a un usuario y permite revocarlo", async () => {
    const trustedUntil = new Date(Date.now() + 60_000).toISOString();

    await expect(trustOfflineDevice(USER_ID, trustedUntil)).resolves.toMatchObject({
      userId: USER_ID,
      trustedUntil,
    });
    await expect(getTrustedOfflineDevice()).resolves.toMatchObject({
      userId: USER_ID,
    });

    await revokeOfflineDeviceTrust();
    await expect(getTrustedOfflineDevice()).resolves.toBeNull();
  });
});
