import { MAX_AWARD_POSITIONS } from "@pegasus/core";

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
 * 5. Empate: si dos o más ejemplares quedan con la misma suma (y ninguno está
 *    cubierto por la regla de mayoría), el sistema marca empate y bloquea el cierre
 *    hasta resolverlo con una ronda de desempate.
 */

export type JudgeCard = {
  judgeUserId: string;
  /** Puesto asignado por este juez a cada participante (participantId -> puesto). */
  positions: Array<{ participantId: string; position: number }>;
  /** Puestos declarados desiertos en esta tarjeta (conservado por compatibilidad, no usado en el cómputo). */
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
  /** Número de jueces que asignaron un puesto a este ejemplar. */
  cardsCount: number;
  /** Puesto final provisional (1 = ganador). Se asigna siempre, incluso con empate. */
  finalPosition: number;
  /** True si comparte suma con otro y no fue resuelto por la regla de mayoría. */
  tied: boolean;
};

export type DesertedPositionResult = {
  finalPosition: number;
  votesCount: number;
};

export type ScoringResult = {
  participants: ScoredParticipant[];
  desertedResults: DesertedPositionResult[];
  hasTie: boolean;
  /** Grupos de participantIds empatados que requieren ronda de desempate. */
  tiedGroups: string[][];
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
  cardsCount: number;
};

/**
 * Calcula el resultado oficial de una tarjeta F2.
 *
 * Aplica la regla de voto de castigo: cada participante elegible que un juez no puntúa
 * recibe automáticamente la posición PENALTY_POSITION (= MAX_AWARD_POSITIONS + 1 = 6).
 * Por tanto, TODOS los participantes elegibles aparecen en el ranking final.
 *
 * @param cards Tarjetas de cada juez (una por juez) con los puestos asignados.
 * @param judgeCount Número total de jueces de la feria (para el umbral de mayoría).
 */
export function computeF2(cards: JudgeCard[], judgeCount: number): ScoringResult {
  if (cards.length === 0) {
    return { participants: [], desertedResults: [], hasTie: false, tiedGroups: [], majorityWinnerId: null };
  }

  const threshold = majorityThreshold(judgeCount);

  // Roster completo: unión de eligibleParticipantIds (si existe) y participantes posicionados.
  const rosterIds = new Set<string>();
  for (const card of cards) {
    const eligible = card.eligibleParticipantIds ?? card.positions.map((p) => p.participantId);
    for (const id of eligible) {
      rosterIds.add(id);
    }
  }

  if (rosterIds.size === 0) {
    return { participants: [], desertedResults: [], hasTie: false, tiedGroups: [], majorityWinnerId: null };
  }

  // Agregación con voto de castigo para jueces que no puntúan al participante.
  const aggregates: Aggregate[] = [];
  for (const participantId of rosterIds) {
    let positionSum = 0;
    let firstPlaceVotes = 0;
    for (const card of cards) {
      const assigned = card.positions.find((p) => p.participantId === participantId);
      if (assigned) {
        positionSum += assigned.position;
        if (assigned.position === 1) {
          firstPlaceVotes += 1;
        }
      } else {
        positionSum += PENALTY_POSITION;
      }
    }
    aggregates.push({ participantId, positionSum, firstPlaceVotes, cardsCount: cards.length });
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

  // Detección de empates: misma suma entre participantes no cubiertos por la mayoría.
  const sumGroups = new Map<number, string[]>();
  for (const agg of aggregates) {
    if (agg.participantId === majorityWinnerId) continue;
    const group = sumGroups.get(agg.positionSum) ?? [];
    group.push(agg.participantId);
    sumGroups.set(agg.positionSum, group);
  }
  const tiedGroups = [...sumGroups.values()].filter((group) => group.length > 1);
  const tiedIds = new Set(tiedGroups.flat());

  let nextFinalPosition = 1;
  const participants: ScoredParticipant[] = ordered.map((agg) => {
    const finalPosition = nextFinalPosition;
    nextFinalPosition += 1;
    return {
      participantId: agg.participantId,
      positionSum: agg.positionSum,
      firstPlaceVotes: agg.firstPlaceVotes,
      cardsCount: agg.cardsCount,
      finalPosition,
      tied: tiedIds.has(agg.participantId)
    };
  });

  return {
    participants,
    // Con votos de castigo todos los puestos quedan cubiertos por participantes; no hay desiertos agregados.
    desertedResults: [],
    hasTie: tiedGroups.length > 0,
    tiedGroups,
    majorityWinnerId
  };
}
