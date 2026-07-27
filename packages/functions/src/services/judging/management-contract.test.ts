import { describe, expect, it } from "vitest";
import {
  buildPositionOutcomes,
  buildTieMembershipByParticipant
} from "./management-contract.js";

describe("contrato API de tieBlocks / outcomes", () => {
  it("expone membresía explícita sin inferir solo desde TIED", () => {
    const membership = buildTieMembershipByParticipant([
      {
        reason: "SUM_EQUALITY",
        participantIds: ["a", "b"],
        positionSum: 10,
        startPosition: 3,
        endPosition: 4,
        resolved: false
      },
      {
        reason: "FIFTH_PLACE_EXCEPTION_5E",
        participantIds: ["c", "d"],
        positionSum: null,
        startPosition: 5,
        endPosition: 6,
        resolved: false
      }
    ]);

    expect(membership.get("a")?.[0]?.reason).toBe("SUM_EQUALITY");
    expect(membership.get("c")?.[0]?.reason).toBe("FIFTH_PLACE_EXCEPTION_5E");
    expect(membership.has("z")).toBe(false);
  });

  it("emite DESERTED con causa y proyecta unawarded histórico como Desierto", () => {
    const outcomes = buildPositionOutcomes({
      deserted: [
        {
          finalPosition: 2,
          desertedVotes: 2,
          reason: "EXPLICIT_MAJORITY",
          assignedVotes: 1,
          minimumRequired: 2
        }
      ],
      unawarded: [{ finalPosition: 4, assignedVotes: 1, minimumRequired: 2 }],
      tieBlocks: [
        {
          reason: "SUM_EQUALITY",
          participantIds: ["a", "b"],
          positionSum: 9,
          startPosition: 3,
          endPosition: 3,
          resolved: false
        },
        {
          reason: "FIFTH_PLACE_EXCEPTION_5E",
          participantIds: ["c", "d"],
          positionSum: null,
          startPosition: 5,
          endPosition: 6,
          resolved: true
        }
      ]
    });

    expect(outcomes.map((row) => row.outcomeType)).toEqual([
      "DESERTED",
      "TIE_BREAK_REQUIRED",
      "DESERTED"
    ]);
    expect(outcomes.find((row) => row.finalPosition === 2)).toMatchObject({
      outcomeType: "DESERTED",
      reason: "EXPLICIT_MAJORITY",
      desertedVotes: 2,
      assignedVotes: 1,
      minimumRequired: 2
    });
    expect(outcomes.find((row) => row.finalPosition === 4)).toMatchObject({
      outcomeType: "DESERTED",
      reason: "INSUFFICIENT_CONSIDERATION",
      assignedVotes: 1,
      minimumRequired: 2,
      desertedVotes: 0
    });
    expect(outcomes.find((row) => row.outcomeType === "TIE_BREAK_REQUIRED")).toMatchObject({
      finalPosition: 3,
      tieBreakReason: "SUM_EQUALITY"
    });
    expect(outcomes.some((row) => row.finalPosition === 5)).toBe(false);
  });

  it("expone el caso de tres asignaciones distintas como DESERTED con assignedVotes=1", () => {
    const outcomes = buildPositionOutcomes({
      deserted: [
        {
          finalPosition: 3,
          reason: "INSUFFICIENT_CONSIDERATION",
          assignedVotes: 1,
          minimumRequired: 2,
          desertedVotes: 0
        }
      ],
      unawarded: [],
      tieBlocks: []
    });

    expect(outcomes).toEqual([
      {
        finalPosition: 3,
        outcomeType: "DESERTED",
        participantId: null,
        reason: "INSUFFICIENT_CONSIDERATION",
        assignedVotes: 1,
        minimumRequired: 2,
        desertedVotes: 0,
        votesCount: 0,
        tieBreakReason: null
      }
    ]);
  });
});
