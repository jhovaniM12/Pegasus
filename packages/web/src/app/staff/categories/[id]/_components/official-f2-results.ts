import type {
  DesertedRoundResult,
  PositionOutcome,
  RoundManagementItem,
  RoundResult,
  UnawardedRoundResult,
} from "@/types/staged-flow";

export type OfficialF2Results = {
  results: RoundResult[];
  desertedResults: DesertedRoundResult[];
  unawardedResults: UnawardedRoundResult[];
  positionOutcomes: PositionOutcome[];
};

function latestF2(rounds: RoundManagementItem[]): RoundManagementItem | null {
  return [...rounds].reverse().find((round) => round.roundType === "F2") ?? null;
}

function resolvePositionOutcomes(f2: RoundManagementItem): PositionOutcome[] {
  if (f2.positionOutcomes && f2.positionOutcomes.length > 0) {
    return f2.positionOutcomes;
  }

  return [
    ...(f2.desertedResults ?? []).map((row) => ({
      finalPosition: row.finalPosition,
      outcomeType: "DESERTED" as const,
      participantId: null,
      assignedVotes: row.assignedVotes ?? 0,
      minimumRequired: null,
      votesCount: row.votesCount,
      awardDistinctive: row.awardDistinctive,
      tieBreakReason: null,
    })),
    ...(f2.unawardedResults ?? []).map((row) => ({
      finalPosition: row.finalPosition,
      outcomeType: "UNAWARDED_INSUFFICIENT_CONSIDERATION" as const,
      participantId: null,
      assignedVotes: row.assignedVotes,
      minimumRequired: row.minimumRequired,
      votesCount: null,
      awardDistinctive: row.awardDistinctive,
      tieBreakReason: null,
    })),
  ].sort((a, b) => a.finalPosition - b.finalPosition);
}

/**
 * Lee el F2 oficial desde la API.
 * Tras el cierre, el backend ya reescribió posiciones/estados a FINAL;
 * no se fusionan desempates en el cliente (fuente de verdad = backend).
 * Antes del cierre, se proyecta el desempate consolidado solo para vista provisional.
 */
export function buildOfficialF2Results(rounds: RoundManagementItem[]): OfficialF2Results | null {
  const f2 = latestF2(rounds);
  const positionOutcomes = f2 ? resolvePositionOutcomes(f2) : [];
  if (!f2 || (f2.results.length === 0 && positionOutcomes.length === 0)) {
    return null;
  }

  const isOfficial = f2.status === "CLOSED" || f2.results.every((result) => result.status === "FINAL");
  if (isOfficial) {
    return {
      results: f2.results.map((result) => ({ ...result, resolvedByTieBreak: false })),
      desertedResults: f2.desertedResults ?? [],
      unawardedResults: f2.unawardedResults ?? [],
      positionOutcomes: positionOutcomes.filter(
        (outcome) => outcome.outcomeType !== "TIE_BREAK_REQUIRED"
      ),
    };
  }

  const resolvedTieBreaks = rounds
    .filter(
      (round) =>
        round.roundType === "TIE_BREAK" &&
        round.status === "CONSOLIDATED" &&
        round.results.length > 0 &&
        round.results.every((result) => result.status !== "TIED")
    )
    .sort((a, b) => a.sequence - b.sequence);

  const tieBreakResultByParticipant = new Map<string, RoundResult>();
  for (const tieBreak of resolvedTieBreaks) {
    for (const result of tieBreak.results) {
      if (result.finalPosition !== null) {
        tieBreakResultByParticipant.set(result.participantId, result);
      }
    }
  }

  const results = f2.results.map((result) => {
    const resolved = tieBreakResultByParticipant.get(result.participantId);
    if (!resolved) {
      return { ...result, resolvedByTieBreak: false };
    }

    return {
      ...result,
      finalPosition: resolved.finalPosition,
      status: "PROVISIONAL" as const,
      awardDistinctive: resolved.awardDistinctive,
      resolvedByTieBreak: true,
      tieMembership: (result.tieMembership ?? []).map((block) => ({
        ...block,
        resolved: true,
      })),
    };
  });

  return {
    results,
    desertedResults: f2.desertedResults ?? [],
    unawardedResults: f2.unawardedResults ?? [],
    positionOutcomes: positionOutcomes.filter(
      (outcome) => outcome.outcomeType !== "TIE_BREAK_REQUIRED"
    ),
  };
}
