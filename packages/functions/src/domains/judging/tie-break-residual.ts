import type { JudgingRoundResultStatus, TieBreakReason } from "@pegasus/core";

export type TieBreakResidualResult = {
  participantId: string;
  scoreValue: number;
  firstPlaceVotes: number;
  finalPosition: number;
  status: JudgingRoundResultStatus;
};

export type ResolvedTieBreakEntry = TieBreakResidualResult & {
  status: "PROVISIONAL" | "FINAL";
};

export type RemainingTiedGroup = {
  reason: TieBreakReason;
  participantIds: string[];
  positionSum: number;
  startPosition: number;
  endPosition: number;
};

export type TieBreakResidual = {
  resolvedEntries: ResolvedTieBreakEntry[];
  remainingTiedGroups: RemainingTiedGroup[];
  availablePositions: number[];
};

function isContiguous(positions: number[]): boolean {
  return positions.every((position, index) => index === 0 || position === positions[index - 1]! + 1);
}

/**
 * Deriva el estado residual exclusivamente del consolidado de un desempate.
 * No consulta ni combina las sumas del F2 padre ni de rondas anteriores.
 */
export function deriveTieBreakResidual(input: {
  startPosition: number;
  endPosition: number;
  results: TieBreakResidualResult[];
}): TieBreakResidual {
  const blockPositions = Array.from(
    { length: input.endPosition - input.startPosition + 1 },
    (_, index) => input.startPosition + index
  );
  const resolvedEntries = input.results
    .filter(
      (row): row is ResolvedTieBreakEntry =>
        row.status !== "TIED" &&
        row.finalPosition >= input.startPosition &&
        row.finalPosition <= input.endPosition
    )
    .sort((left, right) => left.finalPosition - right.finalPosition);
  const resolvedPositions = new Set(resolvedEntries.map((row) => row.finalPosition));
  const availablePositions = blockPositions.filter((position) => !resolvedPositions.has(position));

  const tiedBySum = new Map<number, TieBreakResidualResult[]>();
  for (const row of input.results) {
    if (row.status !== "TIED") continue;
    const group = tiedBySum.get(row.scoreValue) ?? [];
    group.push(row);
    tiedBySum.set(row.scoreValue, group);
  }

  const remainingTiedGroups = [...tiedBySum.entries()]
    .map(([positionSum, rows]): RemainingTiedGroup | null => {
      if (rows.length < 2) return null;
      const ordered = [...rows].sort(
        (left, right) =>
          left.finalPosition - right.finalPosition ||
          left.participantId.localeCompare(right.participantId)
      );
      const positions = ordered.map((row) => row.finalPosition);
      if (
        !isContiguous(positions) ||
        positions.some((position) => !availablePositions.includes(position))
      ) {
        return null;
      }
      return {
        reason: "SUM_EQUALITY",
        participantIds: ordered.map((row) => row.participantId),
        positionSum,
        startPosition: positions[0]!,
        endPosition: positions[0]! + ordered.length - 1
      };
    })
    .filter((group): group is RemainingTiedGroup => group !== null)
    .sort((left, right) => left.startPosition - right.startPosition);

  return { resolvedEntries, remainingTiedGroups, availablePositions };
}
