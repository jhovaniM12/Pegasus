import type { StagedCategory, VeterinaryCheck } from "@/types/staged-flow";
import { cacheOfflineContext, getOfflineContext, trustOfflineDevice } from "./offline-repository";

export type VeterinaryOfflinePayload = {
  summary: StagedCategory;
  checks: VeterinaryCheck[];
};

const TRUSTED_DEVICE_TTL_MS = 18 * 60 * 60 * 1000;

export async function cacheVeterinaryStageSnapshot(input: {
  userId: string;
  summary: StagedCategory;
  checks: VeterinaryCheck[];
}): Promise<void> {
  await cacheOfflineContext<VeterinaryOfflinePayload>({
    userId: input.userId,
    role: "VETERINARIAN",
    stageId: input.summary.stageId,
    fairId: input.summary.fair.id,
    stageRevision: input.summary.revision,
    stageStatus: input.summary.status,
    activeRoundId: null,
    activeTieBlockIdentity: null,
    payload: {
      summary: input.summary,
      checks: input.checks,
    },
    lastServerSyncAt: new Date().toISOString(),
  });

  await trustOfflineDevice(input.userId, new Date(Date.now() + TRUSTED_DEVICE_TTL_MS).toISOString());
}

export async function readVeterinaryStageSnapshot(
  userId: string,
  stageId: string
): Promise<VeterinaryOfflinePayload | null> {
  const context = await getOfflineContext<VeterinaryOfflinePayload>(userId, stageId);
  if (!context) return null;
  return context.payload;
}

export async function patchVeterinaryStageSnapshot(input: {
  userId: string;
  summary: StagedCategory;
  checks: VeterinaryCheck[];
}): Promise<void> {
  await cacheVeterinaryStageSnapshot(input);
}
