import { describe, expect, it } from "vitest";
import type { JudgingRound } from "@pegasus/core";
import {
  resolveRoundTieBlockIdentity,
  STANDARD_TIE_BLOCK_IDENTITY,
} from "./round-identity.js";

function buildRound(partial: Partial<JudgingRound> & Pick<JudgingRound, "roundType">): JudgingRound {
  return {
    id: "round-1",
    fairCategoryStageId: "stage-1",
    sequence: 1,
    status: "OPEN",
    parentRoundId: null,
    tieBreakReason: null,
    tieBreakStartPosition: null,
    tieBreakEndPosition: null,
    openedAt: new Date(),
    consolidatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as JudgingRound;
}

describe("round identity", () => {
  it("usa STANDARD para F1 y F2", () => {
    expect(resolveRoundTieBlockIdentity(buildRound({ roundType: "F1" }), ["a", "b"])).toBe(
      STANDARD_TIE_BLOCK_IDENTITY
    );
    expect(resolveRoundTieBlockIdentity(buildRound({ roundType: "F2" }), ["a", "b"])).toBe(
      STANDARD_TIE_BLOCK_IDENTITY
    );
  });

  it("preserva la identidad tipada del bloque de desempate", () => {
    const identity = resolveRoundTieBlockIdentity(
      buildRound({
        roundType: "TIE_BREAK",
        tieBreakReason: "SUM_EQUALITY",
      }),
      ["b", "a"]
    );

    expect(identity).toBe("SUM_EQUALITY:a|b");
  });
});
