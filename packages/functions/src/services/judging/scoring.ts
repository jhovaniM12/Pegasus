import { MAX_AWARD_POSITIONS, type DesertedReason } from "@pegasus/core";
import type { TieBreakReason } from "@pegasus/core";

export type { DesertedReason };

/**
 * Cómputo oficial de la tarjeta F2 (y de las rondas de desempate, que usan la misma lógica).
 *
 * Reglas reglamentarias FEDEQUINAS (Cap. XI, Art. 15) implementadas aquí, como funciones
 * PURAS para poder probarlas sin base de datos:
 *
 * 1. Cada juez asigna únicamente los puestos que considera merecidos.
 * 2. Al cerrar F2, los puestos sin ejemplar se registran como votos de puesto desierto.
 * 3. Regla de voto de castigo: si un juez NO asigna posición a un participante, ese
 *    participante recibe automáticamente la posición N+1 (donde N = MAX_AWARD_POSITIONS),
 *    es decir, posición 6. La suma se conserva para auditoría y desempates.
 * 4. Consolidación por puesto: un ejemplar solo ocupa un puesto si alcanza la
 *    consideración mínima (mayoría) de asignaciones a ESE puesto. La suma no compacta
 *    ni asciende ejemplares hacia puestos superiores desiertos.
 * 5. Si ninguna asignación alcanza la consideración mínima, el puesto queda DESERTED
 *    (incluye cero asignaciones y consideración insuficiente).
 * 6. Excepción de "mayoría de primeros puestos": si un ejemplar recibe el primer
 *    puesto en la mayoría de las tarjetas, queda adjudicado en el 1.º.
 * 7. Igualdad de suma: si dos o más ejemplares con consideración mínima comparten
 *    suma y no tienen puesto premiable adjudicado por votos, forman un grupo de empate.
 * 8. Excepción 5.e: si todos los jueces asignan quinto, nadie lo declara desierto y
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

/** Modo de consolidación: P2 por puesto absoluto; desempate por ranking relativo de suma. */
export type ScoringMode = "P2" | "TIE_BREAK";

export type DesertedPositionResult = {
  finalPosition: number;
  reason: DesertedReason;
  /** Máximo de votos de asignación que alcanzó un ejemplar en ese puesto. */
  assignedVotes: number;
  minimumRequired: number;
  /** Votos de puesto desierto (explícitos o derivados al cerrar). */
  desertedVotes: number;
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
  /**
   * Puestos oficiales desiertos: sin asignación suficiente para ese puesto
   * (cero asignaciones, consideración insuficiente o mayoría explícita de desierto).
   */
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

function buildDesertedResult(input: {
  finalPosition: number;
  reason: DesertedReason;
  assignedVotes: number;
  minimumRequired: number;
  desertedVotes: number;
}): DesertedPositionResult {
  return {
    finalPosition: input.finalPosition,
    reason: input.reason,
    assignedVotes: input.assignedVotes,
    minimumRequired: input.minimumRequired,
    desertedVotes: input.desertedVotes
  };
}

/**
 * Calcula el resultado oficial de una tarjeta F2 o de desempate.
 *
 * @param cards Tarjetas de cada juez (una por juez) con los puestos asignados.
 * @param judgeCount Número total de jueces de la feria (para el umbral de mayoría).
 * @param mode `P2` adjudica por votos de puesto absoluto; `TIE_BREAK` ordena por suma relativa 1..n.
 */
export function computeF2(
  cards: JudgeCard[],
  judgeCount: number,
  mode: ScoringMode = "P2"
): ScoringResult {
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

  if (mode === "TIE_BREAK") {
    return computeRelativeBySumRanking(aggregates, majorityWinnerId, threshold);
  }

  // Conteo de votos de desierto y de asignaciones por puesto / ejemplar.
  const desertedVoteCountByPosition = new Map<number, number>();
  for (const card of cards) {
    const uniqueDeserted = new Set(card.desertedPositions);
    for (const position of uniqueDeserted) {
      if (!Number.isInteger(position) || position < 1 || position > MAX_AWARD_POSITIONS) continue;
      desertedVoteCountByPosition.set(position, (desertedVoteCountByPosition.get(position) ?? 0) + 1);
    }
  }

  const assignmentVotesByPosition = new Map<number, Map<string, number>>();
  for (const card of cards) {
    const seenPositions = new Set<number>();
    for (const entry of card.positions) {
      if (!Number.isInteger(entry.position) || entry.position < 1 || entry.position > MAX_AWARD_POSITIONS) {
        continue;
      }
      if (seenPositions.has(entry.position)) continue;
      seenPositions.add(entry.position);
      const byHorse = assignmentVotesByPosition.get(entry.position) ?? new Map<string, number>();
      byHorse.set(entry.participantId, (byHorse.get(entry.participantId) ?? 0) + 1);
      assignmentVotesByPosition.set(entry.position, byHorse);
    }
  }

  // Adjudicación por puesto: la suma no compacta ni asciende ejemplares.
  const ranked: Array<Aggregate & { finalPosition: number }> = [];
  const awardedIds = new Set<string>();
  const desertedResults: DesertedPositionResult[] = [];

  for (let position = 1; position <= MAX_AWARD_POSITIONS; position += 1) {
    const desertedVotes = desertedVoteCountByPosition.get(position) ?? 0;
    const votesByHorse = assignmentVotesByPosition.get(position) ?? new Map<string, number>();
    let bestVotes = 0;
    for (const votes of votesByHorse.values()) {
      if (votes > bestVotes) bestVotes = votes;
    }

    if (desertedVotes >= threshold) {
      desertedResults.push(
        buildDesertedResult({
          finalPosition: position,
          reason: "EXPLICIT_MAJORITY",
          assignedVotes: bestVotes,
          minimumRequired: threshold,
          desertedVotes
        })
      );
      continue;
    }

    const leaders = [...votesByHorse.entries()].filter(([, votes]) => votes === bestVotes);
    const winnerId = leaders.length === 1 ? leaders[0]?.[0] ?? null : null;

    if (winnerId != null && bestVotes >= threshold && !awardedIds.has(winnerId)) {
      const aggregate = aggregates.find((agg) => agg.participantId === winnerId);
      if (aggregate) {
        ranked.push({ ...aggregate, finalPosition: position });
        awardedIds.add(winnerId);
        continue;
      }
    }

    desertedResults.push(
      buildDesertedResult({
        finalPosition: position,
        reason: bestVotes === 0 ? "NO_ASSIGNMENTS" : "INSUFFICIENT_CONSIDERATION",
        assignedVotes: bestVotes,
        minimumRequired: threshold,
        desertedVotes
      })
    );
  }

  // Ejemplares sin puesto premiable adjudicado: ranking residual desde el 6.º por suma.
  const deferred = [...aggregates]
    .filter((agg) => !awardedIds.has(agg.participantId))
    .sort((a, b) => {
      if (majorityWinnerId) {
        if (a.participantId === majorityWinnerId) return -1;
        if (b.participantId === majorityWinnerId) return 1;
      }
      if (a.positionSum !== b.positionSum) return a.positionSum - b.positionSum;
      if (a.firstPlaceVotes !== b.firstPlaceVotes) return b.firstPlaceVotes - a.firstPlaceVotes;
      return a.participantId.localeCompare(b.participantId);
    });

  let nextNonAwardPosition = MAX_AWARD_POSITIONS + 1;
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

  // Empates por suma: solo entre ejemplares SIN puesto premiable adjudicado por votos.
  // Si ya ocupan un puesto concreto por consideración, la suma no los desplaza ni abre desempate.
  const sumGroups = new Map<number, string[]>();
  for (const agg of aggregates) {
    if (agg.participantId === majorityWinnerId) continue;
    if (agg.cardsCount < threshold) continue;
    if (awardedIds.has(agg.participantId)) continue;
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
    hasTie: tiedGroups.length > 0,
    hasBlockingTie,
    tiedGroups,
    majorityWinnerId
  };
}

/**
 * Ranking relativo por suma (modo desempate).
 * Conserva el procedimiento histórico: puestos 1..n según mérito de suma,
 * sin desiertos ni adjudicación por votos absolutos de puesto.
 */
function computeRelativeBySumRanking(
  aggregates: Aggregate[],
  majorityWinnerId: string | null,
  threshold: number
): ScoringResult {
  const ordered = [...aggregates].sort((a, b) => {
    if (majorityWinnerId) {
      if (a.participantId === majorityWinnerId) return -1;
      if (b.participantId === majorityWinnerId) return 1;
    }
    if (a.positionSum !== b.positionSum) return a.positionSum - b.positionSum;
    if (a.firstPlaceVotes !== b.firstPlaceVotes) return b.firstPlaceVotes - a.firstPlaceVotes;
    return a.participantId.localeCompare(b.participantId);
  });

  const participants: ScoredParticipant[] = ordered.map((agg, index) => ({
    participantId: agg.participantId,
    positionSum: agg.positionSum,
    firstPlaceVotes: agg.firstPlaceVotes,
    cardsCount: agg.cardsCount,
    finalPosition: index + 1,
    tied: false
  }));
  const positionById = new Map(participants.map((p) => [p.participantId, p.finalPosition]));

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
      blocksClosure: startPosition <= MAX_AWARD_POSITIONS
    });
  }

  const tiedIds = new Set(tiedGroups.flatMap((g) => g.participantIds));
  for (const p of participants) {
    p.tied = tiedIds.has(p.participantId);
  }

  return {
    participants,
    desertedResults: [],
    hasTie: tiedGroups.length > 0,
    hasBlockingTie: tiedGroups.some((g) => g.blocksClosure),
    tiedGroups,
    majorityWinnerId
  };
}
