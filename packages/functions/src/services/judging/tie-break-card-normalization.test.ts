import { describe, expect, it } from "vitest";
import { normalizeTieBreakCardAssignments } from "./tie-break-card-normalization.js";

describe("normalizeTieBreakCardAssignments", () => {
  it("conserva 1.º y 2.º cuando desaparece quien tenía el 3.º", () => {
    expect(
      [...normalizeTieBreakCardAssignments(
        [
          { participantId: "1", position: 1 },
          { participantId: "2", position: 2 }
        ],
        1
      )]
    ).toEqual([
      ["1", 1],
      ["2", 2]
    ]);
  });

  it("comprime 1.º y 3.º a 1.º y 2.º preservando el orden relativo", () => {
    expect(
      [...normalizeTieBreakCardAssignments(
        [
          { participantId: "1", position: 1 },
          { participantId: "2", position: 3 }
        ],
        1
      )]
    ).toEqual([
      ["1", 1],
      ["2", 2]
    ]);
  });

  it("respeta el inicio de un bloque que no comienza en primero", () => {
    expect(
      [...normalizeTieBreakCardAssignments(
        [
          { participantId: "5", position: 5 },
          { participantId: "7", position: 7 }
        ],
        5
      )]
    ).toEqual([
      ["5", 5],
      ["7", 6]
    ]);
  });
});
