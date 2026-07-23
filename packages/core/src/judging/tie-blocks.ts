import { MAX_AWARD_POSITIONS } from "../entities/judging-rounds.entity.js";

export type TieBreakReason = "SUM_EQUALITY" | "FIFTH_PLACE_EXCEPTION_5E";

export type TieBlockRow = {
  finalPosition: number | null;
  scoreValue: number | null;
  status: string;
};

export function tieBlockKey(participantIds: string[]): string {
  return [...participantIds].sort().join("|");
}

export function typedTieBlockKey(reason: TieBreakReason, participantIds: string[]): string {
  return `${reason}:${tieBlockKey(participantIds)}`;
}

/**
 * Reconstruye únicamente bloques por igualdad de suma que bloquean el cierre.
 *
 * Si un grupo de suma comienza dentro del top 5, conserva a TODOS sus integrantes,
 * aunque alguno haya recibido provisionalmente una posición 6+.
 *
 * La excepción especial 5.e no puede inferirse de resultados consolidados, sumas,
 * estado TIED ni posiciones consecutivas. Debe calcularse desde las tarjetas F2.
 */
export function getBlockingTiedBlocks<T extends TieBlockRow>(results: T[]): T[][] {
  const byScore = new Map<number, T[]>();
  for (const result of results) {
    if (result.status !== "TIED" || result.scoreValue == null) continue;
    const group = byScore.get(result.scoreValue) ?? [];
    group.push(result);
    byScore.set(result.scoreValue, group);
  }

  return [...byScore.values()]
    .filter(
      (group) =>
        group.length >= 2 &&
        Math.min(...group.map((row) => row.finalPosition ?? Number.MAX_SAFE_INTEGER)) <=
          MAX_AWARD_POSITIONS
    )
    .sort((a, b) => {
      const startA = Math.min(...a.map((row) => row.finalPosition ?? Number.MAX_SAFE_INTEGER));
      const startB = Math.min(...b.map((row) => row.finalPosition ?? Number.MAX_SAFE_INTEGER));
      return startA - startB;
    });
}
