import type {
  DesertedRoundResult,
  PositionOutcome,
  RoundManagementForm,
  RoundManagementItem,
  RoundResult,
  UnawardedRoundResult,
} from "@/types/staged-flow";

export type OfficialF2Results = {
  results: RoundResult[];
  desertedResults: DesertedRoundResult[];
  unawardedResults: UnawardedRoundResult[];
  positionOutcomes: PositionOutcome[];
  forms: RoundManagementForm[];
};

function latestF2(rounds: RoundManagementItem[]): RoundManagementItem | null {
  return [...rounds].reverse().find((round) => round.roundType === "F2") ?? null;
}

function resolvePositionOutcomes(f2: RoundManagementItem): PositionOutcome[] {
  if (f2.positionOutcomes && f2.positionOutcomes.length > 0) {
    return f2.positionOutcomes;
  }

  const desertedPositions = new Set((f2.desertedResults ?? []).map((row) => row.finalPosition));

  return [
    ...(f2.desertedResults ?? []).map((row) => ({
      finalPosition: row.finalPosition,
      outcomeType: "DESERTED" as const,
      participantId: null,
      assignedVotes: row.assignedVotes ?? 0,
      minimumRequired: row.minimumRequired ?? null,
      votesCount: row.desertedVotes ?? row.votesCount,
      desertedVotes: row.desertedVotes ?? row.votesCount,
      reason: row.reason ?? null,
      disqualifiedParticipantId: row.disqualifiedParticipantId ?? null,
      sourceTieBreakId: row.sourceTieBreakId ?? null,
      awardDistinctive: row.awardDistinctive,
      tieBreakReason: null,
    })),
    ...(f2.unawardedResults ?? [])
      .filter((row) => !desertedPositions.has(row.finalPosition))
      .map((row) => ({
        finalPosition: row.finalPosition,
        outcomeType: "DESERTED" as const,
        participantId: null,
        assignedVotes: row.assignedVotes,
        minimumRequired: row.minimumRequired,
        votesCount: 0,
        desertedVotes: 0,
        reason: "INSUFFICIENT_CONSIDERATION" as const,
        disqualifiedParticipantId: null,
        sourceTieBreakId: null,
        awardDistinctive: row.awardDistinctive,
        tieBreakReason: null,
      })),
  ].sort((a, b) => a.finalPosition - b.finalPosition);
}

/** Puestos premiables del resultado oficial (siempre 1.º–5.º). */
export const OFFICIAL_AWARD_POSITIONS = 5;

function isAwardPosition(position: number | null | undefined): boolean {
  return position != null && position >= 1 && position <= OFFICIAL_AWARD_POSITIONS;
}

/**
 * En el resultado oficial solo entran ejemplares con cinta (puestos 1–5)
 * y los outcomes de esos mismos puestos (incluidos desiertos).
 */
function toOfficialAwardSlice(input: {
  results: RoundResult[];
  desertedResults: DesertedRoundResult[];
  unawardedResults: UnawardedRoundResult[];
  positionOutcomes: PositionOutcome[];
  forms: RoundManagementForm[];
}): OfficialF2Results {
  return {
    results: input.results.filter((result) => isAwardPosition(result.finalPosition)),
    desertedResults: input.desertedResults.filter((row) => isAwardPosition(row.finalPosition)),
    unawardedResults: input.unawardedResults.filter((row) => isAwardPosition(row.finalPosition)),
    positionOutcomes: input.positionOutcomes.filter((row) => isAwardPosition(row.finalPosition)),
    forms: input.forms,
  };
}

/**
 * Lee el F2 oficial desde la API.
 * El backend entrega el F2 efectivo tanto antes como después del cierre. Esta
 * capa solo recorta los puestos visibles; nunca vuelve a aplicar desempates.
 */
export function buildOfficialF2Results(rounds: RoundManagementItem[]): OfficialF2Results | null {
  const f2 = latestF2(rounds);
  const positionOutcomes = f2 ? resolvePositionOutcomes(f2) : [];
  if (!f2 || (f2.results.length === 0 && positionOutcomes.length === 0)) {
    return null;
  }

  const isOfficial = f2.status === "CLOSED" || f2.results.every((result) => result.status === "FINAL");
  if (isOfficial) {
    return toOfficialAwardSlice({
      results: f2.results.map((result) => ({ ...result, resolvedByTieBreak: false })),
      desertedResults: f2.desertedResults ?? [],
      unawardedResults: f2.unawardedResults ?? [],
      positionOutcomes: positionOutcomes.filter(
        (outcome) => outcome.outcomeType !== "TIE_BREAK_REQUIRED"
      ),
      forms: f2.forms,
    });
  }

  return {
    results: f2.results,
    desertedResults: f2.desertedResults ?? [],
    unawardedResults: f2.unawardedResults ?? [],
    positionOutcomes: positionOutcomes.filter(
      (outcome) => outcome.outcomeType !== "TIE_BREAK_REQUIRED"
    ),
    forms: f2.forms,
  };
}
