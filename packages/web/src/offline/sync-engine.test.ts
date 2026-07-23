import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { closeOfflineDatabase, getOfflineDatabase } from "./db";
import { queueOfflineMutation } from "./offline-repository";
import { checkPegasusConnectivity } from "./connectivity";

vi.mock("../services/api.service", () => ({
  ApiError: class ApiError extends Error {
    status: number | null = null;
    code: string | null = null;
    details: unknown;
  },
}));
vi.mock("../services/staged-flow.service", () => ({
  stagedFlowService: {},
}));
import { syncFaStage } from "./sync-engine";

vi.mock("./connectivity", () => ({
  checkPegasusConnectivity: vi.fn(),
}));

const connectivityMock = vi.mocked(checkPegasusConnectivity);
const USER_ID = "11111111-1111-4111-8111-111111111111";
const STAGE_ID = "33333333-3333-4333-8333-333333333333";
const FORM_ID = "44444444-4444-4444-8444-444444444444";

afterEach(async () => {
  await getOfflineDatabase().delete();
  await closeOfflineDatabase();
  vi.clearAllMocks();
});

function createMutation() {
  return queueOfflineMutation({
    deduplicationKey: `FA_FORM:${STAGE_ID}:${FORM_ID}`,
    userId: USER_ID,
    stageId: STAGE_ID,
    aggregateType: "FA_FORM" as const,
    aggregateId: FORM_ID,
    operationType: "UPDATE_FA_SELECTION",
    baseRevision: 3,
    payload: { selectedParticipantIds: ["participant-1"] },
  });
}

describe("sync engine recovery", () => {
  it("simula reinicio después de cerrar la PWA durante SYNCING", async () => {
    const mutation = await createMutation();
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
    const mutation = await createMutation();
    connectivityMock.mockResolvedValue(false);

    const result = await syncFaStage(USER_ID, STAGE_ID);

    expect(result).toEqual({ synced: 0, conflicts: 0, failed: 0, fa: null });
    const pending = await getOfflineDatabase().offlineMutations.get(mutation.operationId);
    expect(pending?.operationId).toBe(mutation.operationId);
    expect(pending?.status).toBe("PENDING");
  });
});
