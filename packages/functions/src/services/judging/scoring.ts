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
 *    DECISIÓN_OPERATIVA (R-F2-5E-EXCL): se excluyen del bloque quienes ya tienen
 *    puesto provisional adjudicado entre el 1.º y el 4.º; el resto disputa solo el 5.º.
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

export type PositionOutcomeType =
  | "AWARDED"
  | "DESERTED"
  | "UNAWARDED_INSUFFICIENT_CONSIDERATION"
  | "TIE_BREAK_REQUIRED";

export type DesertedPositionResult = {
  finalPosition: number;
  /**
   * Número de jueces que declararon el puesto desierto de forma explícita.
   * Solo aplica cuando outcome = DESERTED (ningún juez asignó el puesto a un ejemplar).
   */
  votesCount: number;
};

/**
 * Puesto con asignaciones reales de jueces, pero sin ejemplar que cumpla
 * la consideración mínima exigida para recibir el premio.
 */
export type UnawardedPositionResult = {
  finalPosition: number;
  assignedVotes: number;
  minimumRequired: number;
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
  /** Puestos verdaderamente desiertos: ningún juez asignó ese puesto a un ejemplar. */
  desertedResults: DesertedPositionResult[];
  /**
   * Puestos con asignaciones, pero sin candidato elegible por consideración mínima.
   * Nunca deben confundirse con desiertos.
   */
  unawardedResults: UnawardedPositionResult[];
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
    unawardedResults: [],
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

  // Conteo de declaraciones explícitas de desierto y de asignaciones reales por puesto.
  const desertedVoteCountByPosition = new Map<number, number>();
  for (const card of cards) {
    const uniqueDeserted = new Set(card.desertedPositions);
    for (const position of uniqueDeserted) {
      if (!Number.isInteger(position) || position < 1) continue;
      desertedVoteCountByPosition.set(position, (desertedVoteCountByPosition.get(position) ?? 0) + 1);
    }
  }
  const assignedVotesByPosition = new Map<number, number>();
  for (const card of cards) {
    const uniqueAssigned = new Set(
      card.positions
        .map((entry) => entry.position)
        .filter((position) => Number.isInteger(position) && position >= 1)
    );
    for (const position of uniqueAssigned) {
      assignedVotesByPosition.set(position, (assignedVotesByPosition.get(position) ?? 0) + 1);
    }
  }

  // Nota 5.b: 2/3 o 3/5 declaraciones explícitas hacen desierto el puesto,
  // aunque el juez restante haya asignado allí un ejemplar.
  const explicitDesertedByMajority = new Map<number, number>();
  for (const [position, votesCount] of desertedVoteCountByPosition.entries()) {
    if (votesCount >= threshold) {
      explicitDesertedByMajority.set(position, votesCount);
    }
  }

  // Asignación de puestos (Reglamento FEDEQUINAS, notas aclaratorias 5.b, 5.c y 5.e):
  // 1) Respetar desiertos explícitos por mayoría cuando no hubo asignaciones.
  // 2) En cada puesto premiable, recorrer candidatos en orden de mérito hasta encontrar
  //    uno con consideración mínima (cardsCount >= threshold). Los que no cumplen quedan
  //    diferidos (sin cinta) y no consumen el puesto.
  // 3) Si no queda candidato elegible y no hubo mayoría explícita de desierto:
  //    → UNAWARDED_INSUFFICIENT_CONSIDERATION, incluso con cero asignaciones.
  // 4) Ejemplares no premiables se reubican desde el puesto 6 (sin cinta).
  // 5) Si luego aplica 5.e, se retira el outcome del quinto y se reserva al desempate.
  const ranked: Array<Aggregate & { finalPosition: number }> = [];
  const deferred: Aggregate[] = [];
  const desertedResults: DesertedPositionResult[] = [];
  const unawardedResults: UnawardedPositionResult[] = [];
  let pointer = 0;

  for (let position = 1; position <= MAX_AWARD_POSITIONS; position += 1) {
    const explicitVotes = explicitDesertedByMajority.get(position);
    if (explicitVotes != null) {
      desertedResults.push({ finalPosition: position, votesCount: explicitVotes });
      continue;
    }

    let awarded = false;
    while (pointer < ordered.length) {
      const candidate = ordered[pointer];
      pointer += 1;
      if (candidate.cardsCount < threshold) {
        deferred.push(candidate);
        continue;
      }
      ranked.push({ ...candidate, finalPosition: position });
      awarded = true;
      break;
    }

    if (!awarded) {
      const assignedVotes = assignedVotesByPosition.get(position) ?? 0;
      unawardedResults.push({
        finalPosition: position,
        assignedVotes,
        minimumRequired: threshold
      });
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

  // Excepción 5.e: bloque especial independiente de sumas/consideración mínima.
  // DECISIÓN_OPERATIVA: excluir a quienes ya tienen puesto provisional 1.º–4.º.
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
    const fifthDisputants = [
      ...new Set(
        fifthPlaceParticipantIds.filter((participantId) => {
          const provisionalPosition = positionById.get(participantId);
          return provisionalPosition == null || provisionalPosition > 4;
        })
      )
    ];

    if (fifthDisputants.length >= 2) {
      // El quinto queda reservado al desempate 5.e: retirar outcomes contradictorios
      // y reubicar disputantes en 5..(5+n-1).
      for (let i = desertedResults.length - 1; i >= 0; i -= 1) {
        if (desertedResults[i]?.finalPosition === MAX_AWARD_POSITIONS) {
          desertedResults.splice(i, 1);
        }
      }
      for (let i = unawardedResults.length - 1; i >= 0; i -= 1) {
        if (unawardedResults[i]?.finalPosition === MAX_AWARD_POSITIONS) {
          unawardedResults.splice(i, 1);
        }
      }

      const disputantSet = new Set(fifthDisputants);
      const orderedDisputants = [...participants]
        .filter((p) => disputantSet.has(p.participantId))
        .sort(
          (a, b) =>
            a.finalPosition - b.finalPosition || a.participantId.localeCompare(b.participantId)
        );
      const reservedStart = MAX_AWARD_POSITIONS;
      const reservedEnd = reservedStart + orderedDisputants.length - 1;
      orderedDisputants.forEach((participant, index) => {
        participant.finalPosition = reservedStart + index;
        positionById.set(participant.participantId, participant.finalPosition);
      });

      const displaced = participants
        .filter(
          (p) => !disputantSet.has(p.participantId) && p.finalPosition >= reservedStart
        )
        .sort(
          (a, b) =>
            a.finalPosition - b.finalPosition || a.participantId.localeCompare(b.participantId)
        );
      let nextFree = reservedEnd + 1;
      for (const participant of displaced) {
        participant.finalPosition = nextFree;
        positionById.set(participant.participantId, nextFree);
        nextFree += 1;
      }
      participants.sort((a, b) => a.finalPosition - b.finalPosition);

      tiedGroups.push({
        reason: "FIFTH_PLACE_EXCEPTION_5E",
        participantIds: orderedDisputants.map((p) => p.participantId),
        positionSum: null,
        startPosition: reservedStart,
        endPosition: reservedEnd,
        blocksClosure: true
      });
    }
  }

  const tiedIds = new Set(tiedGroups.flatMap((g) => g.participantIds));
  for (const p of participants) {
    p.tied = tiedIds.has(p.participantId);
  }

  const hasBlockingTie = tiedGroups.some((g) => g.blocksClosure);

  return {
    participants,
    desertedResults: desertedResults.sort((a, b) => a.finalPosition - b.finalPosition),
    unawardedResults: unawardedResults.sort((a, b) => a.finalPosition - b.finalPosition),
    hasTie: tiedGroups.length > 0,
    hasBlockingTie,
    tiedGroups,
    majorityWinnerId
  };
}
