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

describe("buildOfficialF2Results - cierre oficial sin fusión cliente", () => {
  it("cuando F2 está CLOSED usa las filas del backend sin proyectar desempates", () => {
    const official = buildOfficialF2Results([
      baseRound({
        status: "CLOSED",
        results: [
          {
            id: "r1",
            participantId: "p1",
            trackPosition: 1,
            riderName: "A",
            registrationNumber: "1",
            scoreValue: 4,
            firstPlaceVotes: 2,
            finalPosition: 1,
            status: "FINAL",
            awardDistinctive: null,
          },
          {
            id: "r2",
            participantId: "p2",
            trackPosition: 2,
            riderName: "B",
            registrationNumber: "2",
            scoreValue: 9,
            firstPlaceVotes: 0,
            finalPosition: 2,
            status: "FINAL",
            awardDistinctive: null,
          },
          {
            id: "r6",
            participantId: "p6",
            trackPosition: 6,
            riderName: "F",
            registrationNumber: "6",
            scoreValue: 20,
            firstPlaceVotes: 0,
            finalPosition: 6,
            status: "FINAL",
            awardDistinctive: null,
          },
        ],
      }),
      baseRound({
        id: "tb-1",
        roundType: "TIE_BREAK",
        sequence: 1,
        status: "CONSOLIDATED",
        results: [
          {
            id: "t1",
            participantId: "p2",
            trackPosition: 2,
            riderName: "B",
            registrationNumber: "2",
            scoreValue: 3,
            firstPlaceVotes: 1,
            finalPosition: 5,
            status: "PROVISIONAL",
            awardDistinctive: null,
          },
        ],
      }),
    ]);

    expect(official?.results.find((row) => row.participantId === "p2")?.finalPosition).toBe(2);
    expect(official?.results.every((row) => row.status === "FINAL")).toBe(true);
    expect(official?.results.map((row) => row.participantId)).toEqual(["p1", "p2"]);
  });
});

describe("buildOfficialF2Results - outcomes DESERTED con causa", () => {
  it("proyecta desiertos y unawarded históricos como Desierto con razón", () => {
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
            desertedVotes: 0,
            reason: "NO_ASSIGNMENTS",
            assignedVotes: 0,
            minimumRequired: 2,
            outcomeType: "DESERTED",
            awardDistinctive: null,
          },
        ],
        unawardedResults: [
          {
            id: "u1",
            finalPosition: 4,
            assignedVotes: 2,
            minimumRequired: 2,
            outcomeType: "UNAWARDED_INSUFFICIENT_CONSIDERATION",
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
        outcomeType: "DESERTED",
        reason: "INSUFFICIENT_CONSIDERATION",
        assignedVotes: 2,
        minimumRequired: 2,
      }),
      expect.objectContaining({
        finalPosition: 5,
        outcomeType: "DESERTED",
        reason: "NO_ASSIGNMENTS",
        assignedVotes: 0,
      }),
    ]);
  });
});
