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
 * 1. Empates por misma suma de posiciones (status TIED) dentro del top 5.
 *    Quienes quedaron en 6+ (sin cinta) no entran aunque compartan suma.
 * 2. Empates consecutivos en puestos premiables aunque tengan sumas distintas
 *    (p. ej. desempate especial del quinto puesto, nota reglamentaria 5.e).
 *    En ese caso se permite extender al 6.º+ solo si el bloque empieza en el top 5
 *    y los puestos son consecutivos desde ahí (5-6, 5-6-7, …).
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

  // Empates por suma: solo puestos premiables (1..5).
  const scoreBlocks = [...byScore.values()]
    .map((group) =>
      group.filter((row) => (row.finalPosition ?? Number.MAX_SAFE_INTEGER) <= MAX_AWARD_POSITIONS)
    )
    .filter((group) => group.length >= 2)
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

  const flushConsecutive = () => {
    if (current.length < 2) {
      current = [];
      return;
    }

    const startPosition = Math.min(
      ...current.map((row) => row.finalPosition ?? Number.MAX_SAFE_INTEGER)
    );
    if (startPosition > MAX_AWARD_POSITIONS) {
      current = [];
      return;
    }

    // Nota 5.e: si el tramo empieza en <=5 y es continuo (5,6,7), conservar todos.
    // Si el tramo no es continuo desde el start (no debería ocurrir con el acumulador),
    // o si mezclara gaps, no aplica.
    blocksByKey.set(
      tieBlockKey(current.map((row) => getParticipantId(row))),
      current
    );
    current = [];
  };

  for (const result of tiedByPosition) {
    const previous = current.at(-1);
    if (!previous || (result.finalPosition ?? 0) === (previous.finalPosition ?? 0) + 1) {
      current.push(result);
    } else {
      flushConsecutive();
      current = [result];
    }
  }
  flushConsecutive();

  return [...blocksByKey.values()].sort((a, b) => {
    const startA = Math.min(...a.map((row) => row.finalPosition ?? Number.MAX_SAFE_INTEGER));
    const startB = Math.min(...b.map((row) => row.finalPosition ?? Number.MAX_SAFE_INTEGER));
    return startA - startB;
  });
}
