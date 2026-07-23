import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { closeOfflineDatabase, getOfflineDatabase } from "./db";
import { cacheFaStageSnapshot, readFaStageSnapshot } from "./fa-cache";
import { getTrustedOfflineDevice } from "./offline-repository";
import type { FaState } from "@/types/staged-flow";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const STAGE_ID = "33333333-3333-4333-8333-333333333333";

afterEach(async () => {
  await getOfflineDatabase().delete();
  await closeOfflineDatabase();
});

function buildFa(selectedIds: string[]): FaState {
  return {
    stage: {
      stageId: STAGE_ID,
      revision: 2,
      status: "JUDGING_STARTED",
      fair: { id: "fair-1", name: "Feria" },
      gait: { id: "gait-1", name: "Trocha" },
      category: {
        id: "cat-1",
        name: "Categoría",
        minAgeMonths: 36,
        maxAgeMonths: 48,
      },
    },
    form: {
      id: "form-1",
      revision: 4,
      status: "STARTED",
      selectedCount: selectedIds.length,
      disqualifiedCount: 0,
      discardedCount: 0,
      closedAt: null,
    },
    participants: selectedIds.map((id, index) => ({
      id,
      trackPosition: index + 1,
      riderName: `Jinete ${index + 1}`,
      registrationNumber: `REG-${index + 1}`,
      status: "ELIGIBLE",
      disqualificationReason: null,
      disqualifiedBy: null,
      repeatTrackRequest: null,
      decision: {
        id: `decision-${id}`,
        decision: "SELECTED",
        selectionOrder: index + 1,
        disqualificationReason: null,
      },
    })),
    disqualificationReasons: [],
    consolidated: [],
  } as unknown as FaState;
}

describe("fa-cache", () => {
  it("persiste el snapshot FA y marca el dispositivo como confiable", async () => {
    const fa = buildFa(["participant-1", "participant-2"]);

    await cacheFaStageSnapshot({
      userId: USER_ID,
      fa,
      selectedParticipantIds: ["participant-1", "participant-2"],
    });

    await expect(readFaStageSnapshot(USER_ID, STAGE_ID)).resolves.toMatchObject({
      selectedParticipantIds: ["participant-1", "participant-2"],
      fa: { form: { id: "form-1", revision: 4 } },
    });
    await expect(getTrustedOfflineDevice()).resolves.toMatchObject({
      userId: USER_ID,
    });
  });

  it("permite snapshot con selección vacía", async () => {
    const fa = buildFa([]);
    fa.form.selectedCount = 0;

    await cacheFaStageSnapshot({
      userId: USER_ID,
      fa,
      selectedParticipantIds: [],
    });

    await expect(readFaStageSnapshot(USER_ID, STAGE_ID)).resolves.toMatchObject({
      selectedParticipantIds: [],
    });
  });
});
