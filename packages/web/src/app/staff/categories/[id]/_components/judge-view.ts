import type { StagedCategory } from "@/types/staged-flow";

export type JudgePinnedView = "FA" | "F1" | "F2" | "TIE_BREAK";

/**
 * Fases en las que una vista fijada por query param (?view=FA|F1|F2|TIE_BREAK) sigue
 * siendo válida. Si el estado real avanzó más allá, el juez debe redirigirse a la
 * fase vigente (p. ej. de P1 consolidado a "Iniciar tarjeta" de P2).
 *
 * JUDGING_CLOSED / JUDGING_DESERTED permiten consulta histórica en solo lectura.
 * No incluir estados de rondas posteriores activas: el push refresca datos, pero si
 * la vista fijada sigue "válida" el juez permanece en el consolidado anterior.
 */
export const JUDGE_VIEW_VALID_STATUSES: Record<
  JudgePinnedView,
  StagedCategory["status"][]
> = {
  FA: ["JUDGING_STARTED", "FA_CONSOLIDATED", "JUDGING_CLOSED", "JUDGING_DESERTED"],
  F1: [
    "FA_CONSOLIDATED",
    "F1_IN_PROGRESS",
    "F1_CONSOLIDATED",
    "JUDGING_CLOSED",
    "JUDGING_DESERTED",
  ],
  F2: ["F1_CONSOLIDATED", "F2_IN_PROGRESS", "JUDGING_CLOSED", "JUDGING_DESERTED"],
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
