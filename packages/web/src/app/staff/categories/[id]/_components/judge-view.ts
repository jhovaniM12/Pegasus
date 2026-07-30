import type { StagedCategory } from "@/types/staged-flow";

export type JudgePinnedView = "FA" | "F1" | "F2" | "TIE_BREAK";

/**
 * Fases en las que una vista fijada por query param sigue siendo consultable.
 * Una tarjeta cerrada permanece disponible en solo lectura aunque la categoría
 * haya avanzado a una ronda posterior.
 */
export const JUDGE_VIEW_VALID_STATUSES: Record<
  JudgePinnedView,
  StagedCategory["status"][]
> = {
  FA: [
    "JUDGING_STARTED",
    "FA_CONSOLIDATED",
    "F1_IN_PROGRESS",
    "F1_CONSOLIDATED",
    "F2_IN_PROGRESS",
    "TIE_BREAK_IN_PROGRESS",
    "JUDGING_CLOSED",
    "JUDGING_DESERTED",
  ],
  F1: [
    "FA_CONSOLIDATED",
    "F1_IN_PROGRESS",
    "F1_CONSOLIDATED",
    "F2_IN_PROGRESS",
    "TIE_BREAK_IN_PROGRESS",
    "JUDGING_CLOSED",
    "JUDGING_DESERTED",
  ],
  F2: [
    "F1_CONSOLIDATED",
    "F2_IN_PROGRESS",
    "TIE_BREAK_IN_PROGRESS",
    "JUDGING_CLOSED",
    "JUDGING_DESERTED",
  ],
  TIE_BREAK: [
    "F2_IN_PROGRESS",
    "TIE_BREAK_IN_PROGRESS",
    "JUDGING_CLOSED",
    "JUDGING_DESERTED",
  ],
};

export function isJudgeViewStale(
  view: JudgePinnedView,
  status: StagedCategory["status"]
): boolean {
  return !JUDGE_VIEW_VALID_STATUSES[view].includes(status);
}
