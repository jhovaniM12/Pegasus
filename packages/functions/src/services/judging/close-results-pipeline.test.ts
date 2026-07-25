import { describe, expect, it } from "vitest";
import {
  buildPositionOutcomes,
  buildTieMembershipByParticipant
} from "./management-contract.js";
import {
  mergeTieBreaksIntoOfficialF2,
  validateOfficialClosePositions
} from "./official-f2-close.js";
import { computeF2, type JudgeCard } from "./scoring.js";

function card(
  judgeUserId: string,
  ordered: string[],
  eligible: string[] = ordered
): JudgeCard {
  return {
    judgeUserId,
    positions: ordered.map((participantId, index) => ({
      participantId,
      position: index + 1
    })),
    desertedPositions: [],
    eligibleParticipantIds: eligible
  };
}

/**
 * Pipeline de integración (sin BD): consolida F2 → contrato API → desempate →
 * merge oficial → validación de cierre. Replica la secuencia de closeResults.
 */
describe("pipeline closeResults (integración de dominio)", () => {
  it("persiste outcomes, resuelve múltiples desempates y cierra sin TIED residual", () => {
    const eligible = ["A", "B", "C", "D"];
    const f2 = computeF2(
      [card("j1", ["A", "B", "C", "D"]), card("j2", ["B", "A", "C", "D"])],
      2
    );

    // Empate A/B por suma en puestos 1-2.
    expect(f2.hasBlockingTie).toBe(true);
    const sumBlock = f2.tiedGroups.find((group) => group.reason === "SUM_EQUALITY");
    expect(sumBlock?.participantIds.sort()).toEqual(["A", "B"]);

    const provisionalResults = f2.participants.map((participant) => ({
      participantId: participant.participantId,
      scoreValue: participant.positionSum,
      firstPlaceVotes: participant.firstPlaceVotes,
      finalPosition: participant.finalPosition,
      status: (participant.tied ? "TIED" : "PROVISIONAL") as "TIED" | "PROVISIONAL"
    }));

    const pendingBlocks = f2.tiedGroups
      .filter((group) => group.blocksClosure)
      .map((group) => ({
        reason: group.reason,
        participantIds: group.participantIds,
        positionSum: group.positionSum,
        startPosition: group.startPosition,
        endPosition: group.endPosition,
        resolved: false
      }));

    const membership = buildTieMembershipByParticipant(pendingBlocks);
    expect(membership.get("A")?.[0]?.reason).toBe("SUM_EQUALITY");
    const outcomesBefore = buildPositionOutcomes({
      deserted: f2.desertedResults,
      unawarded: f2.unawardedResults,
      tieBlocks: pendingBlocks
    });
    expect(outcomesBefore.some((row) => row.outcomeType === "TIE_BREAK_REQUIRED")).toBe(true);

    // Primer desempate sigue empatado.
    const stillTied = computeF2(
      [card("j1", ["A", "B"]), card("j2", ["B", "A"])],
      2
    );
    expect(stillTied.hasBlockingTie).toBe(true);

    // Segundo desempate define orden.
    const resolvedTie = computeF2(
      [card("j1", ["A", "B"]), card("j2", ["A", "B"])],
      2
    );
    expect(resolvedTie.hasBlockingTie).toBe(false);
    const resolutions = resolvedTie.participants.map((participant) => ({
      participantId: participant.participantId,
      finalPosition: participant.finalPosition,
      sequence: 2
    }));

    const official = mergeTieBreaksIntoOfficialF2(provisionalResults, resolutions);
    const issues = validateOfficialClosePositions({
      results: official,
      outcomePositions: [
        ...f2.desertedResults.map((row) => row.finalPosition),
        ...f2.unawardedResults.map((row) => row.finalPosition)
      ]
    });

    expect(issues).toEqual([]);
    expect(official.every((row) => row.status === "FINAL")).toBe(true);
    expect(official.find((row) => row.participantId === "A")?.finalPosition).toBe(1);
    expect(official.find((row) => row.participantId === "B")?.finalPosition).toBe(2);
    expect(official.some((row) => row.status === "TIED")).toBe(false);

    // Idempotencia de dominio: re-merge sobre FINAL no altera.
    const again = mergeTieBreaksIntoOfficialF2(official, resolutions);
    expect(again).toEqual(official);

    const outcomesAfter = buildPositionOutcomes({
      deserted: f2.desertedResults,
      unawarded: f2.unawardedResults,
      tieBlocks: pendingBlocks.map((block) => ({ ...block, resolved: true }))
    });
    expect(outcomesAfter.some((row) => row.outcomeType === "TIE_BREAK_REQUIRED")).toBe(false);
  });

  it("rechaza cierre con hueco/duplicado o TIED residual", () => {
    const issuesTied = validateOfficialClosePositions({
      results: [
        {
          participantId: "a",
          scoreValue: 4,
          firstPlaceVotes: 1,
          finalPosition: 1,
          status: "TIED"
        }
      ],
      outcomePositions: []
    });
    expect(issuesTied.some((issue) => issue.code === "RESIDUAL_TIED")).toBe(true);

    const issuesDup = validateOfficialClosePositions({
      results: [
        {
          participantId: "a",
          scoreValue: 4,
          firstPlaceVotes: 1,
          finalPosition: 1,
          status: "FINAL"
        },
        {
          participantId: "b",
          scoreValue: 5,
          firstPlaceVotes: 0,
          finalPosition: 1,
          status: "FINAL"
        }
      ],
      outcomePositions: []
    });
    expect(issuesDup.some((issue) => issue.code === "DUPLICATE_POSITION")).toBe(true);
  });
});
