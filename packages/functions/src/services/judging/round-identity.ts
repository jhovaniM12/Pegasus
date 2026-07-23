import type { JudgingRound } from "@pegasus/core";
import { tieBlockKey, typedTieBlockKey } from "@pegasus/core/judging/tie-blocks";
import { RoundReplacedError } from "../../lib/errors.js";

export const STANDARD_TIE_BLOCK_IDENTITY = "STANDARD";

export function resolveRoundTieBlockIdentity(
  round: JudgingRound,
  participantIds: string[]
): string {
  if (round.roundType !== "TIE_BREAK") {
    return STANDARD_TIE_BLOCK_IDENTITY;
  }

  if (round.tieBreakReason) {
    return typedTieBlockKey(round.tieBreakReason, participantIds);
  }

  return tieBlockKey(participantIds);
}

export function assertRoundMutationIdentity(input: {
  stageId: string;
  round: JudgingRound;
  expectedRoundId: string;
  expectedTieBlockIdentity: string;
  participantIds: string[];
}): void {
  const currentTieBlockIdentity = resolveRoundTieBlockIdentity(
    input.round,
    input.participantIds
  );

  if (
    input.round.id !== input.expectedRoundId ||
    currentTieBlockIdentity !== input.expectedTieBlockIdentity
  ) {
    throw new RoundReplacedError({
      stageId: input.stageId,
      expectedRoundId: input.expectedRoundId,
      currentRoundId: input.round.id,
      expectedTieBlockIdentity: input.expectedTieBlockIdentity,
      currentTieBlockIdentity,
    });
  }
}
