import type { TieBreakReason } from "@pegasus/core";

export type ManagementTieBlock = {
  reason: TieBreakReason;
  participantIds: string[];
  positionSum: number | null;
  startPosition: number;
  endPosition: number;
  resolved: boolean;
};

export type ManagementOutcome = {
  finalPosition: number;
  outcomeType: "DESERTED" | "UNAWARDED_INSUFFICIENT_CONSIDERATION" | "TIE_BREAK_REQUIRED";
  participantId: string | null;
  assignedVotes: number;
  minimumRequired: number | null;
  votesCount: number | null;
  tieBreakReason: TieBreakReason | null;
};

export type ResultTieMembership = {
  reason: TieBreakReason;
  positionSum: number | null;
  startPosition: number;
  endPosition: number;
  resolved: boolean;
};

/**
 * Contrato de lectura: membresía explícita a tieBlocks + outcomes TIE_BREAK_REQUIRED.
 * Evita que UI/reportes infieran empate solo desde status === TIED.
 */
export function buildTieMembershipByParticipant(
  tieBlocks: ManagementTieBlock[]
): Map<string, ResultTieMembership[]> {
  const membership = new Map<string, ResultTieMembership[]>();
  for (const block of tieBlocks) {
    for (const participantId of block.participantIds) {
      const existing = membership.get(participantId) ?? [];
      existing.push({
        reason: block.reason,
        positionSum: block.positionSum,
        startPosition: block.startPosition,
        endPosition: block.endPosition,
        resolved: block.resolved
      });
      membership.set(participantId, existing);
    }
  }
  return membership;
}

export function buildPositionOutcomes(input: {
  deserted: Array<{ finalPosition: number; votesCount: number }>;
  unawarded: Array<{ finalPosition: number; assignedVotes: number; minimumRequired: number }>;
  tieBlocks: ManagementTieBlock[];
}): ManagementOutcome[] {
  const desertedOutcomes = input.deserted.map((row) => ({
    finalPosition: row.finalPosition,
    outcomeType: "DESERTED" as const,
    participantId: null,
    assignedVotes: 0,
    minimumRequired: null,
    votesCount: row.votesCount,
    tieBreakReason: null
  }));
  const unawardedOutcomes = input.unawarded.map((row) => ({
    finalPosition: row.finalPosition,
    outcomeType: "UNAWARDED_INSUFFICIENT_CONSIDERATION" as const,
    participantId: null,
    assignedVotes: row.assignedVotes,
    minimumRequired: row.minimumRequired,
    votesCount: null,
    tieBreakReason: null
  }));
  const occupied = new Set([
    ...desertedOutcomes.map((row) => row.finalPosition),
    ...unawardedOutcomes.map((row) => row.finalPosition)
  ]);
  const tieBreakRequired = input.tieBlocks
    .filter((block) => !block.resolved)
    .flatMap((block) => {
      const rows: ManagementOutcome[] = [];
      for (let position = block.startPosition; position <= block.endPosition; position += 1) {
        if (occupied.has(position)) continue;
        rows.push({
          finalPosition: position,
          outcomeType: "TIE_BREAK_REQUIRED",
          participantId: null,
          assignedVotes: 0,
          minimumRequired: null,
          votesCount: null,
          tieBreakReason: block.reason
        });
      }
      return rows;
    });

  return [...desertedOutcomes, ...unawardedOutcomes, ...tieBreakRequired].sort(
    (a, b) => a.finalPosition - b.finalPosition
  );
}
