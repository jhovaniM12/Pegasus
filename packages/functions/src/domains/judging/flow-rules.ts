import type { FairCategoryStageStatus, JudgingRoundType } from "@pegasus/core";

export const F1_SURVIVOR_THRESHOLD = 8;

/**
 * Determina la ronda posterior usando únicamente el estado consolidado y la
 * cantidad real de sobrevivientes elegibles.
 */
export function resolveNextRoundType(
  stageStatus: FairCategoryStageStatus,
  survivorCount: number
): JudgingRoundType {
  if (survivorCount <= 0) {
    throw new Error("No hay ejemplares sobrevivientes para abrir la siguiente ronda.");
  }
  if (stageStatus === "FA_CONSOLIDATED") {
    return survivorCount > F1_SURVIVOR_THRESHOLD ? "F1" : "F2";
  }
  if (stageStatus === "F1_CONSOLIDATED") {
    return "F2";
  }
  throw new Error(`No se puede abrir una ronda desde el estado ${stageStatus}.`);
}
