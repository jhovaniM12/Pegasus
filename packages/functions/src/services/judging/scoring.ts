/**
 * Cómputo oficial de la tarjeta F2 (y de las rondas de desempate, que usan la misma lógica).
 *
 * Reglas reglamentarias FEDEQUINAS (Cap. XI, Art. 15) implementadas aquí, como funciones
 * PURAS para poder probarlas sin base de datos:
 *
 * 1. Cada juez asigna un puesto ordinal (1 = mejor) a cada candidato.
 * 2. La suma de puestos define el orden: menor suma = mejor puesto final.
 * 3. Excepción de "mayoría de primeros puestos": si un ejemplar recibe el primer
 *    puesto en la mayoría de las tarjetas, gana el primer lugar aunque su suma no
 *    sea la menor.
 * 4. Empate: si dos o más ejemplares quedan con la misma suma (y ninguno está
 *    cubierto por la regla de mayoría), el sistema marca empate y bloquea el cierre
 *    hasta resolverlo con una ronda de desempate.
 */

export type JudgeCard = {
  judgeUserId: string;
  /** Puesto asignado por este juez a cada participante (participantId -> puesto). */
  positions: Array<{ participantId: string; position: number }>;
  /** Puestos declarados desiertos en esta tarjeta. */
  desertedPositions: number[];
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

type Aggregate = {
  participantId: string;
  positionSum: number;
  firstPlaceVotes: number;
  cardsCount: number;
};

function aggregate(cards: JudgeCard[]): Map<string, Aggregate> {
  const byParticipant = new Map<string, Aggregate>();

  for (const card of cards) {
    for (const { participantId, position } of card.positions) {
      const current =
        byParticipant.get(participantId) ??
        ({ participantId, positionSum: 0, firstPlaceVotes: 0, cardsCount: 0 } satisfies Aggregate);
      current.positionSum += position;
      current.cardsCount += 1;
      if (position === 1) {
        current.firstPlaceVotes += 1;
      }
      byParticipant.set(participantId, current);
    }
  }

  return byParticipant;
}

/**
 * Calcula el resultado oficial de una tarjeta F2.
 *
 * @param cards Tarjetas de cada juez (una por juez) con los puestos asignados.
 * @param judgeCount Número total de jueces de la feria (para el umbral de mayoría).
 */
export function computeF2(cards: JudgeCard[], judgeCount: number): ScoringResult {
  const aggregates = [...aggregate(cards).values()];
  const threshold = majorityThreshold(judgeCount);
  const desertedVotes = new Map<number, number>();

  for (const card of cards) {
    for (const position of new Set(card.desertedPositions)) {
      desertedVotes.set(position, (desertedVotes.get(position) ?? 0) + 1);
    }
  }

  const desertedResults = [...desertedVotes.entries()]
    .filter(([, votesCount]) => votesCount >= threshold)
    .map(([finalPosition, votesCount]) => ({ finalPosition, votesCount }))
    .sort((a, b) => a.finalPosition - b.finalPosition);
  const awarded = aggregates.filter((agg) => agg.cardsCount >= threshold);
  if (awarded.length === 0) {
    return { participants: [], desertedResults, hasTie: false, tiedGroups: [], majorityWinnerId: null };
  }
  const majorityWinner =
    awarded.find((agg) => agg.firstPlaceVotes >= threshold) ?? null;
  const majorityWinnerId = majorityWinner?.participantId ?? null;

  // Orden base: el ganador por mayoría va primero (si existe); el resto por suma
  // ascendente y, a igualdad de suma, por más primeros puestos y orden estable por id.
  const ordered = [...awarded].sort((a, b) => {
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
  for (const agg of awarded) {
    if (agg.participantId === majorityWinnerId) continue;
    const group = sumGroups.get(agg.positionSum) ?? [];
    group.push(agg.participantId);
    sumGroups.set(agg.positionSum, group);
  }
  const tiedGroups = [...sumGroups.values()].filter((group) => group.length > 1);
  const tiedIds = new Set(tiedGroups.flat());

  const participants: ScoredParticipant[] = ordered.map((agg, index) => ({
    participantId: agg.participantId,
    positionSum: agg.positionSum,
    firstPlaceVotes: agg.firstPlaceVotes,
    cardsCount: agg.cardsCount,
    finalPosition: index + 1,
    tied: tiedIds.has(agg.participantId)
  }));

  return {
    participants,
    desertedResults,
    hasTie: tiedGroups.length > 0,
    tiedGroups,
    majorityWinnerId
  };
}
