import type { RoundManagementItem } from "@/types/staged-flow";
import type { TieBreakReason } from "@pegasus/core/judging/tie-blocks";

export type PendingTieBlockInfo = {
  reason: TieBreakReason;
  startPosition: number;
  endPosition: number;
  trackPositions: number[];
  entries: Array<{
    trackPosition: number;
    horseName: string | null;
    participantId: string;
  }>;
};

function latestConsolidatedF2(rounds: RoundManagementItem[]): RoundManagementItem | null {
  return (
    [...rounds]
      .reverse()
      .find((round) => round.roundType === "F2" && round.status !== "OPEN") ?? null
  );
}

/**
 * Primer bloque activo informado por el backend.
 *
 * La interfaz no reconstruye candidatos desde sumas, rondas históricas ni
 * fingerprints: `tieBlocks` ya representa exclusivamente el estado operativo
 * recalculado sobre el F2 efectivo.
 */
export function findPendingTieBlock(rounds: RoundManagementItem[]): PendingTieBlockInfo | null {
  const f2 = latestConsolidatedF2(rounds);
  if (!f2) return null;

  const pending = f2.tieBlocks.find((block) => block.resolved !== true) ?? null;

  if (!pending) return null;

  const entries = pending.participantIds
    .map((participantId) => {
      const result = f2.results.find((row) => row.participantId === participantId);
      if (!result) return null;
      return {
        participantId,
        trackPosition: result.trackPosition,
        horseName: result.horseName || null,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
    .sort((a, b) => a.trackPosition - b.trackPosition);

  return {
    reason: pending.reason,
    startPosition: pending.startPosition,
    endPosition: pending.endPosition,
    trackPositions: entries.map((entry) => entry.trackPosition),
    entries,
  };
}
