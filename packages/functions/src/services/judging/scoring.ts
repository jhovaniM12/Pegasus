import { MAX_AWARD_POSITIONS } from "@pegasus/core";
import type { TieBreakReason } from "@pegasus/core";

/**
 * Cómputo oficial de la tarjeta F2 (y de las rondas de desempate, que usan la misma lógica).
 *
 * Reglas reglamentarias FEDEQUINAS (Cap. XI, Art. 15) implementadas aquí, como funciones
 * PURAS para poder probarlas sin base de datos:
 *
 * 1. Cada juez asigna un puesto ordinal (1 = mejor) a los candidatos de su preferencia.
 * 2. Regla de voto de castigo: si un juez NO asigna posición a un participante, ese
 *    participante recibe automáticamente la posición N+1 (donde N = MAX_AWARD_POSITIONS),
 *    es decir, posición 6. Todos los participantes elegibles compiten en el ranking final.
 * 3. La suma de puestos (reales + votos de castigo) define el orden: menor suma = mejor.
 * 4. Excepción de "mayoría de primeros puestos": si un ejemplar recibe el primer
 *    puesto en la mayoría de las tarjetas, gana el primer lugar aunque su suma no
 *    sea la menor.
 * 5. Igualdad de suma: si dos o más ejemplares con consideración mínima comparten
 *    suma (y ninguno está cubierto por la regla de mayoría), forman un único grupo.
 *    Si el rango del grupo toca el top 5, participan todos sus integrantes.
 * 6. Excepción 5.e: si todos los jueces asignan quinto, nadie lo declara desierto y
 *    cada juez escoge un ejemplar diferente, esos ejemplares forman un bloque especial
 *    independiente de las sumas y de la consideración mínima ordinaria.
 */

export type JudgeCard = {
  judgeUserId: string;
  /** Puesto asignado por este juez a cada participante (participantId -> puesto). */
  positions: Array<{ participantId: string; position: number }>;
  /** Puestos declarados desiertos en esta tarjeta. */
  desertedPositions: number[];
  /**
   * Todos los participantes elegibles asignados a este formulario.
   * Permite detectar a quienes no recibieron puesto y aplicarles el voto de castigo.
   * Si se omite, el roster se infiere de los participantes con posición asignada.
   */
  eligibleParticipantIds?: string[];
};

export type ScoredParticipant = {
  participantId: string;
  positionSum: number;
  firstPlaceVotes: number;
  /**
   * Número real de jueces que asignaron un puesto a este ejemplar.
   * No incluye jueces que aplicaron voto de castigo.
   */
  cardsCount: number;
  /** Puesto final provisional (1 = ganador). Se asigna siempre, incluso con empate. */
  finalPosition: number;
  /** True si comparte suma con otro y no fue resuelto por la regla de mayoría. */
  tied: boolean;
};

export type DesertedPositionResult = {
  finalPosition: number;
  /**
   * Número de votos que respaldan el desierto para el puesto:
   * - Desierto explícito: cantidad de jueces que lo declararon desierto.
   * - Desierto por agotamiento: 0 (ningún candidato restante puede ocupar el puesto).
   */
  votesCount: number;
};

/**
 * Grupo que requiere una ronda de desempate.
 *
 * La causa se conserva explícitamente porque una igualdad de suma y la excepción
 * reglamentaria 5.e son reglas independientes y nunca deben inferirse por la
 * posición provisional o por filas TIED consecutivas.
 */
export type TiedGroup = {
  reason: TieBreakReason;
  participantIds: string[];
  /** Suma compartida; null para la excepción especial 5.e. */
  positionSum: number | null;
  /** Puesto final más alto (mejor) del grupo (1-indexed). */
  startPosition: number;
  /** Puesto final más bajo (peor) del grupo (1-indexed). */
  endPosition: number;
  /**
   * True si este empate debe resolverse antes de cerrar el resultado oficial.
   * blocksClosure = startPosition <= MAX_AWARD_POSITIONS.
   * Cubre empates dentro del top 5 y empates que cruzan el quinto puesto (5-6),
   * pero excluye empates completamente fuera de premiación (6-7+).
   */
  blocksClosure: boolean;
};

export type ScoringResult = {
  participants: ScoredParticipant[];
  desertedResults: DesertedPositionResult[];
  /** True si existe al menos un grupo empatado (incluye no bloqueantes). */
  hasTie: boolean;
  /**
   * True si al menos un grupo empatado bloquea el resultado oficial
   * (startPosition <= MAX_AWARD_POSITIONS).
   */
  hasBlockingTie: boolean;
  /** Todos los grupos empatados con metadatos de rango y bloqueo. */
  tiedGroups: TiedGroup[];
  majorityWinnerId: string | null;
};

/** Mayoría simple de tarjetas: más de la mitad de los jueces. */
export function majorityThreshold(judgeCount: number): number {
  return Math.floor(judgeCount / 2) + 1;
}

/** Posición de castigo que recibe un participante cuando un juez no lo puntúa. */
const PENALTY_POSITION = MAX_AWARD_POSITIONS + 1;

type Aggregate = {
  participantId: string;
  positionSum: number;
  firstPlaceVotes: number;
  /** Jueces que efectivamente asignaron puesto (excluye votos de castigo). */
  cardsCount: number;
};

/**
 * Calcula el resultado oficial de una tarjeta F2.
 *
 * Aplica la regla de voto de castigo: cada participante elegible que un juez no puntúa
 * recibe automáticamente la posición PENALTY_POSITION (= MAX_AWARD_POSITIONS + 1 = 6).
 * Por tanto, TODOS los participantes elegibles aparecen en el ranking final.
 *
 * El `cardsCount` refleja cuántos jueces realmente asignaron un puesto (sin contar votos
 * de castigo), para aplicar la regla reglamentaria de consideración mínima para premiación.
 *
 * Los grupos de empate (`tiedGroups`) llevan metadatos de rango y bandera `blocksClosure`
 * que indica si el empate afecta posiciones premiables (1..MAX_AWARD_POSITIONS).
 *
 * @param cards Tarjetas de cada juez (una por juez) con los puestos asignados.
 * @param judgeCount Número total de jueces de la feria (para el umbral de mayoría).
 */
export function computeF2(cards: JudgeCard[], judgeCount: number): ScoringResult {
  const empty: ScoringResult = {
    participants: [],
    desertedResults: [],
    hasTie: false,
    hasBlockingTie: false,
    tiedGroups: [],
    majorityWinnerId: null
  };
  if (cards.length === 0) return empty;

  const threshold = majorityThreshold(judgeCount);

  // Roster completo: unión de eligibleParticipantIds (si existe) y participantes posicionados.
  const rosterIds = new Set<string>();
  for (const card of cards) {
    const eligible = card.eligibleParticipantIds ?? card.positions.map((p) => p.participantId);
    for (const id of eligible) {
      rosterIds.add(id);
    }
  }

  if (rosterIds.size === 0) return empty;

  // Agregación: voto de castigo afecta la suma pero no el cardsCount real.
  const aggregates: Aggregate[] = [];
  for (const participantId of rosterIds) {
    let positionSum = 0;
    let firstPlaceVotes = 0;
    let realCardsCount = 0;
    for (const card of cards) {
      const assigned = card.positions.find((p) => p.participantId === participantId);
      if (assigned) {
        positionSum += assigned.position;
        realCardsCount += 1;
        if (assigned.position === 1) firstPlaceVotes += 1;
      } else {
        positionSum += PENALTY_POSITION;
      }
    }
    aggregates.push({ participantId, positionSum, firstPlaceVotes, cardsCount: realCardsCount });
  }

  const majorityWinner = aggregates.find((agg) => agg.firstPlaceVotes >= threshold) ?? null;
  const majorityWinnerId = majorityWinner?.participantId ?? null;

  // Orden: ganador por mayoría primero; resto por suma ascendente, luego primeros puestos, luego id estable.
  const ordered = [...aggregates].sort((a, b) => {
    if (majorityWinnerId) {
      if (a.participantId === majorityWinnerId) return -1;
      if (b.participantId === majorityWinnerId) return 1;
    }
    if (a.positionSum !== b.positionSum) return a.positionSum - b.positionSum;
    if (a.firstPlaceVotes !== b.firstPlaceVotes) return b.firstPlaceVotes - a.firstPlaceVotes;
    return a.participantId.localeCompare(b.participantId);
  });

  // Conteo de puestos desiertos explícitos por mayoría de jueces.
  const desertedVoteCountByPosition = new Map<number, number>();
  for (const card of cards) {
    const uniqueDeserted = new Set(card.desertedPositions);
    for (const position of uniqueDeserted) {
      if (!Number.isInteger(position) || position < 1) continue;
      desertedVoteCountByPosition.set(position, (desertedVoteCountByPosition.get(position) ?? 0) + 1);
    }
  }
  const explicitDesertedByMajority = new Map<number, number>();
  for (const [position, votesCount] of desertedVoteCountByPosition.entries()) {
    if (votesCount >= threshold) {
      explicitDesertedByMajority.set(position, votesCount);
    }
  }

  // Asignación de puestos (Reglamento FEDEQUINAS, notas aclaratorias 5.b, 5.c y 5.e):
  // 1) Respetar desiertos explícitos por mayoría de jueces.
  // 2) En cada puesto premiable, recorrer candidatos en orden de mérito hasta encontrar
  //    uno con consideración mínima (cardsCount >= threshold). Los que no cumplen quedan
  //    diferidos (sin cinta) y no consumen el puesto.
  // 3) Desierto por agotamiento: si no queda ningún candidato que cumpla consideración
  //    mínima para ese puesto.
  // 4) Ejemplares no premiables se reubican desde el puesto 6 (sin cinta).
  //
  // La excepción 5.e se detecta DESPUÉS y de forma independiente a partir de las
  // selecciones individuales de quinto de todos los jueces. No altera este ranking
  // provisional ni desplaza candidatos antes de formar los grupos por suma.
  const ranked: Array<Aggregate & { finalPosition: number }> = [];
  const deferred: Aggregate[] = [];
  const desertedResults: DesertedPositionResult[] = [];
  let pointer = 0;

  for (let position = 1; position <= MAX_AWARD_POSITIONS; position += 1) {
    const explicitVotes = explicitDesertedByMajority.get(position);
    if (explicitVotes != null) {
      desertedResults.push({ finalPosition: position, votesCount: explicitVotes });
      continue;
    }

    let assigned = false;
    while (pointer < ordered.length) {
      const candidate = ordered[pointer];
      pointer += 1;
      if (candidate.cardsCount < threshold) {
        deferred.push(candidate);
        continue;
      }
      ranked.push({ ...candidate, finalPosition: position });
      assigned = true;
      break;
    }

    if (!assigned) {
      desertedResults.push({ finalPosition: position, votesCount: 0 });
    }
  }

  while (pointer < ordered.length) {
    deferred.push(ordered[pointer]);
    pointer += 1;
  }

  let nextNonAwardPosition =
    Math.max(MAX_AWARD_POSITIONS, ...ranked.map((participant) => participant.finalPosition)) + 1;
  for (const participant of deferred) {
    ranked.push({ ...participant, finalPosition: nextNonAwardPosition++ });
  }

  ranked.sort((a, b) => a.finalPosition - b.finalPosition);
  const participants: ScoredParticipant[] = ranked.map((agg) => ({
    participantId: agg.participantId,
    positionSum: agg.positionSum,
    firstPlaceVotes: agg.firstPlaceVotes,
    cardsCount: agg.cardsCount,
    finalPosition: agg.finalPosition,
    tied: false // se actualiza abajo
  }));
  const positionById = new Map(participants.map((p) => [p.participantId, p.finalPosition]));

  // Detección de empates: misma suma entre participantes no cubiertos por la mayoría.
  // Solo entran al grupo quienes cumplen consideración mínima (nota 5.c): el desempate
  // define puestos premiables, no reordena ejemplares "sin cinta".
  const sumGroups = new Map<number, string[]>();
  for (const agg of aggregates) {
    if (agg.participantId === majorityWinnerId) continue;
    if (agg.cardsCount < threshold) continue;
    const group = sumGroups.get(agg.positionSum) ?? [];
    group.push(agg.participantId);
    sumGroups.set(agg.positionSum, group);
  }

  const tiedGroups: TiedGroup[] = [];
  for (const [positionSum, participantIds] of sumGroups.entries()) {
    if (participantIds.length < 2) continue;
    const positions = participantIds.map((id) => positionById.get(id) ?? Number.MAX_SAFE_INTEGER);
    const startPosition = Math.min(...positions);
    const endPosition = startPosition + participantIds.length - 1;
    tiedGroups.push({
      reason: "SUM_EQUALITY",
      participantIds,
      positionSum,
      startPosition,
      endPosition,
      // Bloquea cierre si afecta posiciones premiables: cubre empates dentro del top 5
      // y empates que cruzan el quinto puesto (5-6); excluye empates 6-7+.
      blocksClosure: startPosition <= MAX_AWARD_POSITIONS
    });
  }

  // Excepción 5.e: únicamente aplica cuando están todas las tarjetas esperadas,
  // ningún juez declara desierto el quinto, cada tarjeta contiene exactamente una
  // selección de quinto y todos los jueces escogieron ejemplares diferentes.
  const fifthSelectionsByCard = cards.map((card) =>
    card.positions.filter((position) => position.position === MAX_AWARD_POSITIONS)
  );
  const everyJudgeSelectedExactlyOneFifth =
    cards.length === judgeCount && fifthSelectionsByCard.every((selections) => selections.length === 1);
  const noJudgeDesertedFifth = cards.every(
    (card) => !card.desertedPositions.includes(MAX_AWARD_POSITIONS)
  );
  const fifthPlaceParticipantIds = fifthSelectionsByCard.flatMap((selections) =>
    selections.map((selection) => selection.participantId)
  );
  const everyJudgeSelectedDifferentFifth =
    new Set(fifthPlaceParticipantIds).size === judgeCount;

  if (
    judgeCount > 1 &&
    everyJudgeSelectedExactlyOneFifth &&
    noJudgeDesertedFifth &&
    everyJudgeSelectedDifferentFifth
  ) {
    tiedGroups.push({
      reason: "FIFTH_PLACE_EXCEPTION_5E",
      participantIds: fifthPlaceParticipantIds,
      positionSum: null,
      startPosition: MAX_AWARD_POSITIONS,
      endPosition: MAX_AWARD_POSITIONS + fifthPlaceParticipantIds.length - 1,
      blocksClosure: true
    });
  }

  const tiedIds = new Set(tiedGroups.flatMap((g) => g.participantIds));
  for (const p of participants) {
    p.tied = tiedIds.has(p.participantId);
  }

  const hasBlockingTie = tiedGroups.some((g) => g.blocksClosure);

  return {
    participants,
    desertedResults: desertedResults.sort((a, b) => a.finalPosition - b.finalPosition),
    hasTie: tiedGroups.length > 0,
    hasBlockingTie,
    tiedGroups,
    majorityWinnerId
  };
}
