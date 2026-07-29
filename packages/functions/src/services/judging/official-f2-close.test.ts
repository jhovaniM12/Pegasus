import { describe, expect, it } from "vitest";
import {
  buildEffectiveF2Result,
  buildTieBreakDisqualificationOutcomes,
  isEffectivePositionResolved,
  mergeTieBreaksIntoOfficialF2,
  validateOfficialClosePositions
} from "./official-f2-close.js";

describe("buildEffectiveF2Result", () => {
  it("aplica secuencialmente el triple desempate 4.º–6.º sin alterar las sumas F2", () => {
    const effective = buildEffectiveF2Result(
      [
        {
          participantId: "3",
          scoreValue: 14,
          firstPlaceVotes: 0,
          finalPosition: 4,
          status: "TIED"
        },
        {
          participantId: "5",
          scoreValue: 14,
          firstPlaceVotes: 0,
          finalPosition: 5,
          status: "TIED"
        },
        {
          participantId: "6",
          scoreValue: 14,
          firstPlaceVotes: 0,
          finalPosition: 6,
          status: "TIED"
        },
        {
          participantId: "7",
          scoreValue: 17,
          firstPlaceVotes: 0,
          finalPosition: 7,
          status: "PROVISIONAL"
        }
      ],
      [
        { participantId: "3", finalPosition: 4, sequence: 1 },
        { participantId: "5", finalPosition: 5, sequence: 1 },
        { participantId: "6", finalPosition: 6, sequence: 1 }
      ]
    );

    expect(
      effective.map((row) => ({
        participantId: row.participantId,
        scoreValue: row.scoreValue,
        finalPosition: row.finalPosition,
        resolvedByTieBreak: row.resolvedByTieBreak
      }))
    ).toEqual([
      { participantId: "3", scoreValue: 14, finalPosition: 4, resolvedByTieBreak: true },
      { participantId: "5", scoreValue: 14, finalPosition: 5, resolvedByTieBreak: true },
      { participantId: "6", scoreValue: 14, finalPosition: 6, resolvedByTieBreak: true },
      { participantId: "7", scoreValue: 17, finalPosition: 7, resolvedByTieBreak: false }
    ]);
    expect(isEffectivePositionResolved(effective, 5)).toBe(true);
  });

  it("es determinista e idempotente frente a la misma resolución consolidada", () => {
    const original = [
      {
        participantId: "5",
        scoreValue: 14,
        firstPlaceVotes: 0,
        finalPosition: 5,
        status: "TIED" as const
      }
    ];
    const resolution = [{ participantId: "5", finalPosition: 5, sequence: 1 }];

    expect(buildEffectiveF2Result(original, resolution)).toEqual(
      buildEffectiveF2Result(original, [...resolution, ...resolution])
    );
  });

  it("excluye definitivamente un descalificado sin mover ejemplares externos al bloque", () => {
    const effective = buildEffectiveF2Result(
      [
        { participantId: "1", scoreValue: 6, firstPlaceVotes: 1, finalPosition: 1, status: "TIED" },
        { participantId: "2", scoreValue: 6, firstPlaceVotes: 1, finalPosition: 2, status: "TIED" },
        { participantId: "3", scoreValue: 6, firstPlaceVotes: 1, finalPosition: 3, status: "TIED" },
        { participantId: "4", scoreValue: 10, firstPlaceVotes: 0, finalPosition: 4, status: "PROVISIONAL" },
        { participantId: "5", scoreValue: 12, firstPlaceVotes: 0, finalPosition: 5, status: "PROVISIONAL" }
      ],
      [
        { participantId: "1", finalPosition: 1, sequence: 1 },
        { participantId: "3", finalPosition: 2, sequence: 1 }
      ],
      new Set(["2"])
    );

    expect(effective.map((row) => [row.participantId, row.finalPosition, row.scoreValue])).toEqual([
      ["1", 1, 6],
      ["3", 2, 6],
      ["4", 4, 10],
      ["5", 5, 12]
    ]);
    expect(effective.some((row) => row.participantId === "2")).toBe(false);
    expect(
      validateOfficialClosePositions({
        results: effective,
        outcomePositions: [3]
      })
    ).toEqual([]);
  });
});

describe("buildTieBreakDisqualificationOutcomes", () => {
  it("deja el último puesto del empate triple desierto por una descalificación", () => {
    expect(
      buildTieBreakDisqualificationOutcomes({
        startPosition: 1,
        endPosition: 3,
        survivingParticipantCount: 2,
        disqualifiedParticipantIds: ["2"],
        sourceTieBreakId: "tb-1"
      })
    ).toEqual([
      {
        finalPosition: 3,
        reason: "DISQUALIFICATION_DURING_TIE_BREAK",
        disqualifiedParticipantId: "2",
        sourceTieBreakId: "tb-1"
      }
    ]);
  });

  it("materializa dos puestos desiertos cuando hay dos descalificados", () => {
    expect(
      buildTieBreakDisqualificationOutcomes({
        startPosition: 1,
        endPosition: 3,
        survivingParticipantCount: 1,
        disqualifiedParticipantIds: ["3", "2"],
        sourceTieBreakId: "tb-1"
      }).map((row) => row.finalPosition)
    ).toEqual([2, 3]);
  });

  it("en 5.e adjudica quinto al sobreviviente y deja desierto solo el sobrante", () => {
    expect(
      buildTieBreakDisqualificationOutcomes({
        startPosition: 5,
        endPosition: 6,
        survivingParticipantCount: 1,
        disqualifiedParticipantIds: ["7"],
        sourceTieBreakId: "tb-5e"
      }).map((row) => row.finalPosition)
    ).toEqual([6]);
  });

  it("si todos los candidatos 5.e son descalificados deja quinto y sexto desiertos", () => {
    expect(
      buildTieBreakDisqualificationOutcomes({
        startPosition: 5,
        endPosition: 6,
        survivingParticipantCount: 0,
        disqualifiedParticipantIds: ["5", "7"],
        sourceTieBreakId: "tb-5e"
      }).map((row) => row.finalPosition)
    ).toEqual([5, 6]);
  });
});

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
