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

export type EffectiveF2ResultRow = ClosableF2ResultRow & {
  resolvedByTieBreak: boolean;
  resolvedByTieBreakSequence: number | null;
};

/**
 * Fuente única del resultado efectivo de F2.
 *
 * El F2 recibido es una fotografía inmutable: `scoreValue` y
 * `firstPlaceVotes` nunca se recalculan ni se sobrescriben. Los desempates
 * consolidados se aplican en orden determinista y solo sustituyen el puesto y
 * el estado derivado del participante.
 */
export function buildEffectiveF2Result(
  f2Results: ClosableF2ResultRow[],
  resolutions: TieBreakResolutionRow[],
  excludedParticipantIds: ReadonlySet<string> = new Set()
): EffectiveF2ResultRow[] {
  const ordered = [...resolutions].sort(
    (a, b) =>
      a.sequence - b.sequence ||
      a.finalPosition - b.finalPosition ||
      a.participantId.localeCompare(b.participantId)
  );
  const resolutionByParticipant = new Map<
    string,
    { finalPosition: number; sequence: number }
  >();
  for (const row of ordered) {
    resolutionByParticipant.set(row.participantId, {
      finalPosition: row.finalPosition,
      sequence: row.sequence
    });
  }

  return f2Results.filter((row) => !excludedParticipantIds.has(row.participantId)).map((row) => {
    const resolution = resolutionByParticipant.get(row.participantId);
    return {
      ...row,
      finalPosition: resolution?.finalPosition ?? row.finalPosition,
      status: resolution ? ("FINAL" as const) : row.status,
      resolvedByTieBreak: resolution != null,
      resolvedByTieBreakSequence: resolution?.sequence ?? null
    };
  });
}

export function isEffectivePositionResolved(
  results: EffectiveF2ResultRow[],
  finalPosition: number
): boolean {
  return results.some(
    (result) => result.finalPosition === finalPosition && result.resolvedByTieBreak
  );
}

export type TieBreakDisqualificationOutcome = {
  finalPosition: number;
  reason: "DISQUALIFICATION_DURING_TIE_BREAK";
  disqualifiedParticipantId: string;
  sourceTieBreakId: string;
};

/**
 * Reserva el bloque original: los sobrevivientes ocupan sus primeros puestos
 * y cada baja deja desierto uno de los puestos restantes. Nunca rellena el
 * bloque con participantes externos.
 */
export function buildTieBreakDisqualificationOutcomes(input: {
  startPosition: number;
  endPosition: number;
  survivingParticipantCount: number;
  disqualifiedParticipantIds: string[];
  sourceTieBreakId: string;
}): TieBreakDisqualificationOutcome[] {
  const firstDesertedPosition = input.startPosition + input.survivingParticipantCount;
  return [...input.disqualifiedParticipantIds]
    .sort()
    .map((participantId, index) => ({
      finalPosition: firstDesertedPosition + index,
      reason: "DISQUALIFICATION_DURING_TIE_BREAK" as const,
      disqualifiedParticipantId: participantId,
      sourceTieBreakId: input.sourceTieBreakId
    }))
    .filter((row) => row.finalPosition <= input.endPosition);
}

/** Compatibilidad para consumidores del cierre oficial. */
export function mergeTieBreaksIntoOfficialF2(
  f2Results: ClosableF2ResultRow[],
  resolutions: TieBreakResolutionRow[],
  excludedParticipantIds: ReadonlySet<string> = new Set()
): ClosableF2ResultRow[] {
  return buildEffectiveF2Result(f2Results, resolutions, excludedParticipantIds).map(
    ({ resolvedByTieBreak: _resolved, resolvedByTieBreakSequence: _sequence, ...row }) => ({
      ...row,
      status: "FINAL" as const
    })
  );
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
