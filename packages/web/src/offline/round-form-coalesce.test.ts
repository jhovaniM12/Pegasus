import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { closeOfflineDatabase, getOfflineDatabase } from "./db";
import { listMutationsForUser, queueOfflineMutation } from "./offline-repository";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const STAGE_ID = "33333333-3333-4333-8333-333333333333";
const ROUND_ID = "55555555-5555-4555-8555-555555555555";
const FORM_ID = "66666666-6666-4666-8666-666666666666";

afterEach(async () => {
  await getOfflineDatabase().delete();
  await closeOfflineDatabase();
});

describe("round form offline coalescing", () => {
  it("conserva posiciones F2 como unidad al coalescer", async () => {
    const first = await queueOfflineMutation({
      deduplicationKey: `ROUND_FORM:${STAGE_ID}:${ROUND_ID}:STANDARD:${FORM_ID}`,
      userId: USER_ID,
      stageId: STAGE_ID,
      aggregateType: "ROUND_FORM",
      aggregateId: FORM_ID,
      operationType: "UPDATE_ROUND_FORM",
      baseRevision: 2,
      payload: {
        roundId: ROUND_ID,
        tieBlockIdentity: "STANDARD",
        positions: [{ participantId: "p1", position: 1 }],
        desertedPositions: [2, 3, 4, 5],
      },
    });

    const second = await queueOfflineMutation({
      deduplicationKey: `ROUND_FORM:${STAGE_ID}:${ROUND_ID}:STANDARD:${FORM_ID}`,
      userId: USER_ID,
      stageId: STAGE_ID,
      aggregateType: "ROUND_FORM",
      aggregateId: FORM_ID,
      operationType: "UPDATE_ROUND_FORM",
      baseRevision: 2,
      payload: {
        roundId: ROUND_ID,
        tieBlockIdentity: "STANDARD",
        positions: [
          { participantId: "p1", position: 1 },
          { participantId: "p2", position: 2 },
        ],
        desertedPositions: [3, 4, 5],
      },
    });

    expect(second.operationId).toBe(first.operationId);
    expect(second.payload).toEqual({
      roundId: ROUND_ID,
      tieBlockIdentity: "STANDARD",
      positions: [
        { participantId: "p1", position: 1 },
        { participantId: "p2", position: 2 },
      ],
      desertedPositions: [3, 4, 5],
    });
    await expect(listMutationsForUser(USER_ID)).resolves.toHaveLength(1);
  });

  it("vincula nota y recordatorios a roundId + formId + participantId", async () => {
    await queueOfflineMutation({
      deduplicationKey: `ROUND_NOTE:${ROUND_ID}:${FORM_ID}:participant-1`,
      userId: USER_ID,
      stageId: STAGE_ID,
      aggregateType: "ROUND_NOTE",
      aggregateId: `${FORM_ID}:participant-1`,
      operationType: "UPDATE_ROUND_NOTE",
      baseRevision: 4,
      payload: {
        roundId: ROUND_ID,
        tieBlockIdentity: "STANDARD",
        participantId: "participant-1",
        note: "Observación",
      },
    });

    await queueOfflineMutation({
      deduplicationKey: `ROUND_REMINDERS:${ROUND_ID}:${FORM_ID}:participant-1`,
      userId: USER_ID,
      stageId: STAGE_ID,
      aggregateType: "ROUND_REMINDERS",
      aggregateId: `${FORM_ID}:participant-1`,
      operationType: "UPDATE_ROUND_REMINDERS",
      baseRevision: 4,
      payload: {
        roundId: ROUND_ID,
        tieBlockIdentity: "STANDARD",
        participantId: "participant-1",
        reminders: [{ reminderId: "77777777-7777-4777-8777-777777777777", effect: "SUMA" }],
      },
    });

    const mutations = await listMutationsForUser(USER_ID);
    expect(mutations).toHaveLength(2);
    expect(mutations.map((item) => item.aggregateType).sort()).toEqual([
      "ROUND_NOTE",
      "ROUND_REMINDERS",
    ]);
  });
});
