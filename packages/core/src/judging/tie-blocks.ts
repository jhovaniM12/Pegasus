import { MAX_AWARD_POSITIONS } from "../entities/judging-rounds.entity.js";

export type TieBlockRow = {
  finalPosition: number | null;
  scoreValue: number | null;
  status: string;
};

export function tieBlockKey(participantIds: string[]): string {
  return [...participantIds].sort().join("|");
}

/**
 * Agrupa bloques de empate que bloquean el cierre oficial.
 *
 * 1. Empates por misma suma de posiciones (status TIED).
 * 2. Empates consecutivos en puestos premiables aunque tengan sumas distintas
 *    (p. ej. desempate especial del quinto puesto, nota reglamentaria 5.e).
 */
export function getBlockingTiedBlocks<T extends TieBlockRow>(
  results: T[],
  getParticipantId: (row: T) => string
): T[][] {
  const byScore = new Map<number, T[]>();
  for (const result of results) {
    if (result.status !== "TIED" || result.scoreValue == null) continue;
    const group = byScore.get(result.scoreValue) ?? [];
    group.push(result);
    byScore.set(result.scoreValue, group);
  }

  const scoreBlocks = [...byScore.values()]
    .filter((group) => {
      if (group.length < 2) return false;
      const startPosition = Math.min(...group.map((row) => row.finalPosition ?? Number.MAX_SAFE_INTEGER));
      return startPosition <= MAX_AWARD_POSITIONS;
    })
    .sort((a, b) => {
      const startA = Math.min(...a.map((row) => row.finalPosition ?? Number.MAX_SAFE_INTEGER));
      const startB = Math.min(...b.map((row) => row.finalPosition ?? Number.MAX_SAFE_INTEGER));
      return startA - startB;
    });

  const blocksByKey = new Map<string, T[]>();
  for (const block of scoreBlocks) {
    blocksByKey.set(
      tieBlockKey(block.map((row) => getParticipantId(row))),
      block
    );
  }

  const tiedByPosition = results
    .filter((result) => result.status === "TIED" && result.finalPosition != null)
    .sort((a, b) => (a.finalPosition ?? 0) - (b.finalPosition ?? 0));

  let current: T[] = [];
  for (const result of tiedByPosition) {
    const previous = current.at(-1);
    if (!previous || (result.finalPosition ?? 0) === (previous.finalPosition ?? 0) + 1) {
      current.push(result);
    } else {
      if (
        current.length > 1 &&
        Math.min(...current.map((row) => row.finalPosition ?? Number.MAX_SAFE_INTEGER)) <= MAX_AWARD_POSITIONS
      ) {
        blocksByKey.set(
          tieBlockKey(current.map((row) => getParticipantId(row))),
          current
        );
      }
      current = [result];
    }
  }

  if (
    current.length > 1 &&
    Math.min(...current.map((row) => row.finalPosition ?? Number.MAX_SAFE_INTEGER)) <= MAX_AWARD_POSITIONS
  ) {
    blocksByKey.set(
      tieBlockKey(current.map((row) => getParticipantId(row))),
      current
    );
  }

  return [...blocksByKey.values()].sort((a, b) => {
    const startA = Math.min(...a.map((row) => row.finalPosition ?? Number.MAX_SAFE_INTEGER));
    const startB = Math.min(...b.map((row) => row.finalPosition ?? Number.MAX_SAFE_INTEGER));
    return startA - startB;
  });
}
