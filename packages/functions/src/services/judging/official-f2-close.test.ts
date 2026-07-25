import { describe, expect, it } from "vitest";
import {
  mergeTieBreaksIntoOfficialF2,
  validateOfficialClosePositions
} from "./official-f2-close.js";

describe("mergeTieBreaksIntoOfficialF2", () => {
  it("reescribe posiciones empatadas y deja todo FINAL", () => {
    const merged = mergeTieBreaksIntoOfficialF2(
      [
        {
          participantId: "a",
          scoreValue: 4,
          firstPlaceVotes: 2,
          finalPosition: 1,
          status: "PROVISIONAL"
        },
        {
          participantId: "b",
          scoreValue: 8,
          firstPlaceVotes: 0,
          finalPosition: 3,
          status: "TIED"
        },
        {
          participantId: "c",
          scoreValue: 8,
          firstPlaceVotes: 0,
          finalPosition: 4,
          status: "TIED"
        }
      ],
      [
        { participantId: "b", finalPosition: 3, sequence: 1 },
        { participantId: "c", finalPosition: 4, sequence: 1 }
      ]
    );

    expect(merged).toEqual([
      expect.objectContaining({ participantId: "a", finalPosition: 1, status: "FINAL" }),
      expect.objectContaining({ participantId: "b", finalPosition: 3, status: "FINAL" }),
      expect.objectContaining({ participantId: "c", finalPosition: 4, status: "FINAL" })
    ]);
  });

  it("la resolución posterior gana si hay solape", () => {
    const merged = mergeTieBreaksIntoOfficialF2(
      [
        {
          participantId: "b",
          scoreValue: 10,
          firstPlaceVotes: 0,
          finalPosition: 5,
          status: "TIED"
        }
      ],
      [
        { participantId: "b", finalPosition: 6, sequence: 1 },
        { participantId: "b", finalPosition: 5, sequence: 2 }
      ]
    );

    expect(merged[0]?.finalPosition).toBe(5);
    expect(merged[0]?.status).toBe("FINAL");
  });
});

describe("validateOfficialClosePositions", () => {
  it("rechaza TIED residual y duplicados", () => {
    expect(
      validateOfficialClosePositions({
        results: [
          {
            participantId: "a",
            scoreValue: 3,
            firstPlaceVotes: 1,
            finalPosition: 1,
            status: "TIED"
          }
        ],
        outcomePositions: []
      }).some((issue) => issue.code === "RESIDUAL_TIED")
    ).toBe(true);

    expect(
      validateOfficialClosePositions({
        results: [
          {
            participantId: "a",
            scoreValue: 3,
            firstPlaceVotes: 1,
            finalPosition: 1,
            status: "FINAL"
          },
          {
            participantId: "b",
            scoreValue: 4,
            firstPlaceVotes: 0,
            finalPosition: 1,
            status: "FINAL"
          }
        ],
        outcomePositions: []
      }).some((issue) => issue.code === "DUPLICATE_POSITION")
    ).toBe(true);
  });

  it("acepta resultado oficial coherente con desierto", () => {
    expect(
      validateOfficialClosePositions({
        results: [
          {
            participantId: "a",
            scoreValue: 3,
            firstPlaceVotes: 2,
            finalPosition: 1,
            status: "FINAL"
          },
          {
            participantId: "b",
            scoreValue: 6,
            firstPlaceVotes: 0,
            finalPosition: 2,
            status: "FINAL"
          }
        ],
        outcomePositions: [3]
      })
    ).toEqual([]);
  });
});
