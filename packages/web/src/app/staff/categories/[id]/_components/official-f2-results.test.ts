import { describe, expect, it } from "vitest";
import { buildOfficialF2Results } from "@/app/staff/categories/[id]/_components/official-f2-results";
import type { RoundManagementItem } from "@/types/staged-flow";

function baseRound(overrides: Partial<RoundManagementItem>): RoundManagementItem {
  return {
    id: "f2-1",
    roundType: "F2",
    sequence: 1,
    status: "CONSOLIDATED",
    openedAt: null,
    tieBreakReason: null,
    tieBreakStartPosition: null,
    tieBreakEndPosition: null,
    tieBlocks: [],
    forms: [],
    results: [],
    desertedResults: [],
    unawardedResults: [],
    positionOutcomes: [],
    tests: [],
    ...overrides,
  };
}

describe("buildOfficialF2Results - outcomes DESERTED vs UNAWARDED", () => {
  it("diferencia puestos desiertos de no adjudicados", () => {
    const official = buildOfficialF2Results([
      baseRound({
        results: [
          {
            id: "r1",
            participantId: "p1",
            trackPosition: 1,
            riderName: "A",
            registrationNumber: "1",
            scoreValue: 3,
            firstPlaceVotes: 2,
            finalPosition: 1,
            status: "FINAL",
            awardDistinctive: null,
          },
        ],
        desertedResults: [
          {
            id: "d1",
            finalPosition: 5,
            votesCount: 0,
            outcomeType: "DESERTED",
            assignedVotes: 0,
            awardDistinctive: null,
          },
        ],
        unawardedResults: [
          {
            id: "u1",
            finalPosition: 4,
            assignedVotes: 2,
            minimumRequired: 2,
            outcomeType: "UNAWARDED_MINIMUM_CONSIDERATION",
            awardDistinctive: null,
          },
        ],
      }),
    ]);

    expect(official?.desertedResults.map((row) => row.finalPosition)).toEqual([5]);
    expect(official?.unawardedResults.map((row) => row.finalPosition)).toEqual([4]);
    expect(official?.positionOutcomes).toEqual([
      expect.objectContaining({
        finalPosition: 4,
        outcomeType: "UNAWARDED_MINIMUM_CONSIDERATION",
        assignedVotes: 2,
      }),
      expect.objectContaining({
        finalPosition: 5,
        outcomeType: "DESERTED",
        assignedVotes: 0,
      }),
    ]);
  });
});
