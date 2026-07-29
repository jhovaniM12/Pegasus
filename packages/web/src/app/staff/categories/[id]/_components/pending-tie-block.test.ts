import { describe, expect, it } from "vitest";
import type { RoundManagementItem } from "@/types/staged-flow";
import { findPendingTieBlock } from "./pending-tie-block";

function f2(tieBlocks: RoundManagementItem["tieBlocks"]): RoundManagementItem {
  return {
    id: "f2",
    roundType: "F2",
    sequence: 1,
    status: "CONSOLIDATED",
    openedAt: null,
    tieBreakReason: null,
    tieBreakStartPosition: null,
    tieBreakEndPosition: null,
    tieBlocks,
    forms: [],
    results: [],
    desertedResults: [],
    unawardedResults: [],
    positionOutcomes: [],
    tests: []
  };
}

describe("findPendingTieBlock", () => {
  it("no infiere 5.e ni vuelve a convocar #7 cuando el backend no informa bloques activos", () => {
    expect(findPendingTieBlock([f2([])])).toBeNull();
  });
});
