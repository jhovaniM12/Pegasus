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

function resolvedTieBreaks(rounds: RoundManagementItem[]): RoundManagementItem[] {
  return rounds
    .filter(
      (round) =>
        round.roundType === "TIE_BREAK" &&
        round.status === "CONSOLIDATED" &&
        round.results.length > 0 &&
        round.results.every((result) => result.status !== "TIED")
    )
    .sort((a, b) => a.sequence - b.sequence);
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
    })),
    ...(f2.unawardedResults ?? []).map((row) => ({
      finalPosition: row.finalPosition,
      outcomeType: "UNAWARDED_MINIMUM_CONSIDERATION" as const,
      participantId: null,
      assignedVotes: row.assignedVotes,
      minimumRequired: row.minimumRequired,
      votesCount: null,
      awardDistinctive: row.awardDistinctive,
    })),
  ].sort((a, b) => a.finalPosition - b.finalPosition);
}

export function buildOfficialF2Results(rounds: RoundManagementItem[]): OfficialF2Results | null {
  const f2 = latestF2(rounds);
  const positionOutcomes = f2 ? resolvePositionOutcomes(f2) : [];
  if (!f2 || (f2.results.length === 0 && positionOutcomes.length === 0)) {
    return null;
  }

  const tieBreakResultByParticipant = new Map<string, RoundResult>();
  for (const tieBreak of resolvedTieBreaks(rounds)) {
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
      // El desempate define el orden, pero el resultado sigue siendo provisional
      // hasta que el Director cierre oficialmente la categoría.
      status: "PROVISIONAL" as const,
      awardDistinctive: resolved.awardDistinctive,
      resolvedByTieBreak: true,
    };
  });

  return {
    results,
    desertedResults: f2.desertedResults ?? [],
    unawardedResults: f2.unawardedResults ?? [],
    positionOutcomes,
  };
}
