import type { JudgingRoundResultStatus } from "@pegasus/core";

export type ClosableF2ResultRow = {
  participantId: string;
  scoreValue: number;
  firstPlaceVotes: number;
  finalPosition: number;
  status: JudgingRoundResultStatus;
};

export type TieBreakResolutionRow = {
  participantId: string;
  finalPosition: number;
  sequence: number;
};

/**
 * Fusiona desempates consolidados sobre el F2 provisional.
 * Las resoluciones posteriores (mayor sequence) ganan si hay solape.
 */
export function mergeTieBreaksIntoOfficialF2(
  f2Results: ClosableF2ResultRow[],
  resolutions: TieBreakResolutionRow[]
): ClosableF2ResultRow[] {
  const ordered = [...resolutions].sort((a, b) => a.sequence - b.sequence);
  const positionByParticipant = new Map<string, number>();
  for (const row of ordered) {
    positionByParticipant.set(row.participantId, row.finalPosition);
  }

  return f2Results.map((row) => {
    const resolvedPosition = positionByParticipant.get(row.participantId);
    return {
      ...row,
      finalPosition: resolvedPosition ?? row.finalPosition,
      status: "FINAL" as const
    };
  });
}

export type OfficialCloseValidationIssue =
  | { code: "RESIDUAL_TIED"; participantId: string }
  | { code: "DUPLICATE_POSITION"; finalPosition: number }
  | { code: "CONFLICTING_OUTCOME"; finalPosition: number }
  | { code: "AWARD_GAP"; finalPosition: number };

/**
 * Valida que el resultado oficial no deje TIED, duplicados ni conflictos
 * entre participantes y outcomes. Si hay puestos premiables ocupados,
 * no permite huecos dentro del rango 1..max(ocupado, outcomes capado a 5).
 */
export function validateOfficialClosePositions(input: {
  results: ClosableF2ResultRow[];
  outcomePositions: number[];
  maxAwardPositions?: number;
}): OfficialCloseValidationIssue[] {
  const maxAward = input.maxAwardPositions ?? 5;
  const issues: OfficialCloseValidationIssue[] = [];

  for (const row of input.results) {
    if (row.status === "TIED") {
      issues.push({ code: "RESIDUAL_TIED", participantId: row.participantId });
    }
  }

  const occupied = new Map<number, "RESULT" | "OUTCOME">();
  for (const row of input.results) {
    const existing = occupied.get(row.finalPosition);
    if (existing) {
      issues.push({ code: "DUPLICATE_POSITION", finalPosition: row.finalPosition });
    } else {
      occupied.set(row.finalPosition, "RESULT");
    }
  }

  for (const position of input.outcomePositions) {
    const existing = occupied.get(position);
    if (existing) {
      issues.push({ code: "CONFLICTING_OUTCOME", finalPosition: position });
    } else {
      occupied.set(position, "OUTCOME");
    }
  }

  const awardSlots = [...occupied.keys()].filter((position) => position >= 1 && position <= maxAward);
  if (awardSlots.length > 0) {
    const maxOccupiedAward = Math.max(...awardSlots);
    for (let position = 1; position <= maxOccupiedAward; position += 1) {
      if (!occupied.has(position)) {
        issues.push({ code: "AWARD_GAP", finalPosition: position });
      }
    }
  }

  return issues;
}
