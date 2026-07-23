import type { FaState } from "@/types/staged-flow";
import { cacheOfflineContext, getOfflineContext, trustOfflineDevice } from "./offline-repository";

export type FaOfflinePayload = {
  fa: FaState;
  selectedParticipantIds: string[];
};

const TRUSTED_DEVICE_TTL_MS = 18 * 60 * 60 * 1000;

export async function cacheFaStageSnapshot(input: {
  userId: string;
  fa: FaState;
  selectedParticipantIds: string[];
}): Promise<void> {
  await cacheOfflineContext<FaOfflinePayload>({
    userId: input.userId,
    role: "JUDGE",
    stageId: input.fa.stage.stageId,
    fairId: input.fa.stage.fair.id,
    stageRevision: input.fa.stage.revision,
    stageStatus: input.fa.stage.status,
    activeRoundId: null,
    activeTieBlockIdentity: null,
    payload: {
      fa: input.fa,
      selectedParticipantIds: input.selectedParticipantIds,
    },
    lastServerSyncAt: new Date().toISOString(),
  });

  await trustOfflineDevice(input.userId, new Date(Date.now() + TRUSTED_DEVICE_TTL_MS).toISOString());
}

export async function readFaStageSnapshot(
  userId: string,
  stageId: string
): Promise<FaOfflinePayload | null> {
  const context = await getOfflineContext<FaOfflinePayload>(userId, stageId);
  if (!context) return null;
  return context.payload;
}
