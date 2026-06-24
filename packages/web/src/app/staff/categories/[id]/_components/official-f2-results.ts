import type { DesertedRoundResult, RoundManagementItem, RoundResult } from "@/types/staged-flow";

type OfficialF2Results = {
  results: RoundResult[];
  desertedResults: DesertedRoundResult[];
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

export function buildOfficialF2Results(rounds: RoundManagementItem[]): OfficialF2Results | null {
  const f2 = latestF2(rounds);
  if (!f2 || (f2.results.length === 0 && f2.desertedResults.length === 0)) {
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
      return result;
    }

    return {
      ...result,
      finalPosition: resolved.finalPosition,
      status: "FINAL" as const,
      awardDistinctive: resolved.awardDistinctive,
    };
  });

  return {
    results,
    desertedResults: f2.desertedResults,
  };
}
