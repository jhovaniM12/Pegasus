import { tieBlockKey, typedTieBlockKey } from "@pegasus/core/judging/tie-blocks";
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

function getResolvedTieBlockKeys(rounds: RoundManagementItem[]): {
  typed: Set<string>;
  legacy: Set<string>;
} {
  const resolved = {
    typed: new Set<string>(),
    legacy: new Set<string>(),
  };
  for (const round of rounds) {
    if (round.roundType !== "TIE_BREAK" || round.status !== "CONSOLIDATED") continue;
    if (round.results.some((result) => result.status === "TIED")) continue;

    const participantIds = new Set<string>();
    for (const form of round.forms) {
      for (const entry of form.entries) {
        participantIds.add(entry.participantId);
      }
    }
    if (participantIds.size > 1) {
      if (round.tieBreakReason) {
        resolved.typed.add(typedTieBlockKey(round.tieBreakReason, [...participantIds]));
      } else {
        resolved.legacy.add(tieBlockKey([...participantIds]));
      }
    }
  }
  return resolved;
}

function latestConsolidatedF2(rounds: RoundManagementItem[]): RoundManagementItem | null {
  return (
    [...rounds]
      .reverse()
      .find((round) => round.roundType === "F2" && round.status !== "OPEN") ?? null
  );
}

/** Primer bloque de empate F2 aún pendiente de resolver con desempate. */
export function findPendingTieBlock(rounds: RoundManagementItem[]): PendingTieBlockInfo | null {
  const f2 = latestConsolidatedF2(rounds);
  if (!f2) return null;

  const resolvedTieBlockKeys = getResolvedTieBlockKeys(rounds);
  const pending =
    f2.tieBlocks.find((block) => {
      if (block.resolved === true) return false;
      if (block.resolved === false) return true;
      return (
        !resolvedTieBlockKeys.typed.has(typedTieBlockKey(block.reason, block.participantIds)) &&
        !resolvedTieBlockKeys.legacy.has(tieBlockKey(block.participantIds))
      );
    }) ?? null;

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
