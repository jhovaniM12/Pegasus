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

function rankingCard(
  judgeUserId: string,
  positions: Array<[participantId: string, position: number]>,
  eligible: string[],
  desertedPositions: number[] = []
): JudgeCard {
  return {
    judgeUserId,
    positions: positions.map(([participantId, position]) => ({ participantId, position })),
    desertedPositions,
    eligibleParticipantIds: eligible
  };
}

/**
 * Pipeline de integración (sin BD): consolida F2 → contrato API → desempate →
 * merge oficial → validación de cierre. Replica la secuencia de closeResults.
 */
describe("pipeline closeResults (integración de dominio)", () => {
  it("persiste outcomes DESERTED, resuelve 5.e y cierra sin TIED residual", () => {
    const eligible = ["A", "B", "C", "D", "E", "F", "G"];
    const f2 = computeF2(
      [
        rankingCard("j1", [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["E", 5]], eligible),
        rankingCard("j2", [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["F", 5]], eligible),
        rankingCard("j3", [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["G", 5]], eligible)
      ],
      3
    );

    expect(f2.hasBlockingTie).toBe(true);
    const fifthBlock = f2.tiedGroups.find((group) => group.reason === "FIFTH_PLACE_EXCEPTION_5E");
    expect(fifthBlock?.participantIds.sort()).toEqual(["E", "F", "G"]);
    expect(f2.desertedResults).toEqual([]);

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
    expect(membership.get("E")?.[0]?.reason).toBe("FIFTH_PLACE_EXCEPTION_5E");
    const outcomesBefore = buildPositionOutcomes({
      deserted: f2.desertedResults,
      unawarded: [],
      tieBlocks: pendingBlocks
    });
    expect(outcomesBefore.some((row) => row.outcomeType === "TIE_BREAK_REQUIRED")).toBe(true);

    const stillTied = computeF2(
      [
        rankingCard("j1", [["E", 1], ["F", 2], ["G", 3]], ["E", "F", "G"]),
        rankingCard("j2", [["F", 1], ["E", 2], ["G", 3]], ["E", "F", "G"])
      ],
      2,
      "TIE_BREAK"
    );
    expect(stillTied.hasBlockingTie).toBe(true);

    const resolvedTie = computeF2(
      [
        rankingCard("j1", [["F", 1], ["E", 2], ["G", 3]], ["E", "F", "G"]),
        rankingCard("j2", [["F", 1], ["E", 2], ["G", 3]], ["E", "F", "G"]),
        rankingCard("j3", [["F", 1], ["E", 2], ["G", 3]], ["E", "F", "G"])
      ],
      3,
      "TIE_BREAK"
    );
    expect(resolvedTie.hasBlockingTie).toBe(false);
    const resolutions = resolvedTie.participants.map((participant) => ({
      participantId: participant.participantId,
      finalPosition: fifthBlock!.startPosition + participant.finalPosition - 1,
      sequence: 2
    }));

    const official = mergeTieBreaksIntoOfficialF2(provisionalResults, resolutions);
    const issues = validateOfficialClosePositions({
      results: official,
      outcomePositions: [
        ...f2.desertedResults.map((row) => row.finalPosition),
        
      ]
    });

    expect(issues).toEqual([]);
    expect(official.every((row) => row.status === "FINAL")).toBe(true);
    expect(official.find((row) => row.participantId === "F")?.finalPosition).toBe(5);
  });

  it("expone puestos desiertos en el contrato cuando hay mayoría de desierto", () => {
    const eligible = ["A", "B", "C", "D"];
    const f2 = computeF2(
      [
        rankingCard("j1", [["A", 2]], eligible, [1, 3, 4, 5]),
        rankingCard("j2", [["A", 2]], eligible, [1, 3, 4, 5]),
        rankingCard("j3", [], eligible, [1, 2, 3, 4, 5])
      ],
      3
    );

    expect(f2.participants.find((p) => p.participantId === "A")?.finalPosition).toBe(2);
    expect(f2.desertedResults.map((row) => row.finalPosition)).toEqual([1, 3, 4, 5]);

    const outcomes = buildPositionOutcomes({
      deserted: f2.desertedResults,
      unawarded: [],
      tieBlocks: []
    });
    expect(outcomes.every((row) => row.outcomeType === "DESERTED")).toBe(true);
    expect(outcomes.map((row) => row.finalPosition)).toEqual([1, 3, 4, 5]);
    expect(outcomes.find((row) => row.finalPosition === 1)?.reason).toBe("EXPLICIT_MAJORITY");
  });
});
