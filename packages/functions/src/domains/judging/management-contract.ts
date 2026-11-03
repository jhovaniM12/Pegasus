import type { DesertedReason, TieBreakReason } from "@pegasus/core";

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
  /** @deprecated Preferir desertedVotes; se conserva como alias de lectura. */
  votesCount: number | null;
  desertedVotes: number | null;
  reason: DesertedReason | null;
  tieBreakReason: TieBreakReason | null;
  disqualifiedParticipantId: string | null;
  sourceTieBreakId: string | null;
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

/**
 * Emite outcomes oficiales. Los puestos desiertos nuevos llevan causa y métricas.
 * Filas históricas `unawarded` se proyectan como DESERTED (compatibilidad de UI).
 */
export function buildPositionOutcomes(input: {
  deserted: Array<{
    finalPosition: number;
    desertedVotes: number;
    reason: DesertedReason | null;
    assignedVotes: number;
    minimumRequired: number | null;
    disqualifiedParticipantId?: string | null;
    sourceTieBreakId?: string | null;
  }>;
  /** Históricos: se muestran como Desierto con causa INSUFFICIENT_CONSIDERATION. */
  unawarded: Array<{ finalPosition: number; assignedVotes: number; minimumRequired: number }>;
  tieBlocks: ManagementTieBlock[];
}): ManagementOutcome[] {
  const desertedOutcomes = input.deserted.map((row) => ({
    finalPosition: row.finalPosition,
    outcomeType: "DESERTED" as const,
    participantId: null,
    assignedVotes: row.assignedVotes,
    minimumRequired: row.minimumRequired,
    votesCount: row.desertedVotes,
    desertedVotes: row.desertedVotes,
    reason: row.reason,
    tieBreakReason: null,
    disqualifiedParticipantId: row.disqualifiedParticipantId ?? null,
    sourceTieBreakId: row.sourceTieBreakId ?? null
  }));

  const occupied = new Set(desertedOutcomes.map((row) => row.finalPosition));

  // Históricos unawarded → DESERTED visible (sin migración destructiva).
  const legacyDesertedOutcomes = input.unawarded
    .filter((row) => !occupied.has(row.finalPosition))
    .map((row) => ({
      finalPosition: row.finalPosition,
      outcomeType: "DESERTED" as const,
      participantId: null,
      assignedVotes: row.assignedVotes,
      minimumRequired: row.minimumRequired,
      votesCount: 0,
      desertedVotes: 0,
      reason: "INSUFFICIENT_CONSIDERATION" as const,
      tieBreakReason: null,
      disqualifiedParticipantId: null,
      sourceTieBreakId: null
    }));

  for (const row of legacyDesertedOutcomes) {
    occupied.add(row.finalPosition);
  }

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
          desertedVotes: null,
          reason: null,
          tieBreakReason: block.reason,
          disqualifiedParticipantId: null,
          sourceTieBreakId: null
        });
      }
      return rows;
    });

  return [...desertedOutcomes, ...legacyDesertedOutcomes, ...tieBreakRequired].sort(
    (a, b) => a.finalPosition - b.finalPosition
  );
}
