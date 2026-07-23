import type { RoundState } from "@/types/staged-flow";
import { cacheOfflineContext, getOfflineContext, trustOfflineDevice } from "./offline-repository";

export type RoundOfflinePayload = {
  round: RoundState;
};

const TRUSTED_DEVICE_TTL_MS = 18 * 60 * 60 * 1000;

export async function cacheRoundStageSnapshot(input: {
  userId: string;
  round: RoundState;
}): Promise<void> {
  await cacheOfflineContext<RoundOfflinePayload>({
    userId: input.userId,
    role: "JUDGE",
    stageId: input.round.stage.stageId,
    fairId: input.round.stage.fair.id,
    stageRevision: input.round.stage.revision,
    stageStatus: input.round.stage.status,
    activeRoundId: input.round.round.id,
    activeTieBlockIdentity: input.round.round.tieBlockIdentity,
    payload: {
      round: input.round,
    },
    lastServerSyncAt: new Date().toISOString(),
  });

  await trustOfflineDevice(input.userId, new Date(Date.now() + TRUSTED_DEVICE_TTL_MS).toISOString());
}

export async function readRoundStageSnapshot(
  userId: string,
  stageId: string
): Promise<RoundOfflinePayload | null> {
  const context = await getOfflineContext<RoundOfflinePayload>(userId, stageId);
  if (!context?.payload?.round) return null;
  return context.payload;
}
