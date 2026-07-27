import { describe, expect, it } from "vitest";
import { resolveNextRoundType } from "./flow-rules.js";
import {
  mergeTieBreaksIntoOfficialF2,
  validateOfficialClosePositions
} from "./official-f2-close.js";
import { computeF2, type JudgeCard } from "./scoring.js";

type Participant = { id: string; status: "ELIGIBLE" | "DISQUALIFIED" };

function rankingCard(
  judgeUserId: string,
  positions: Array<[string, number]>,
  eligible: string[]
): JudgeCard {
  return {
    judgeUserId,
    positions: positions.map(([participantId, position]) => ({ participantId, position })),
    desertedPositions: [],
    eligibleParticipantIds: eligible
  };
}

function survivorsFromVotes(
  participants: Participant[],
  cards: Array<{ selected: string[] }>
): string[] {
  const eligible = new Set(
    participants.filter((p) => p.status === "ELIGIBLE").map((p) => p.id)
  );
  const votes = new Map<string, number>();
  for (const card of cards) {
    for (const id of new Set(card.selected)) {
      if (!eligible.has(id)) continue;
      votes.set(id, (votes.get(id) ?? 0) + 1);
    }
  }
  return [...votes.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id]) => id);
}

function toProvisional(scoring: ReturnType<typeof computeF2>) {
  return scoring.participants.map((p) => ({
    participantId: p.participantId,
    scoreValue: p.positionSum,
    firstPlaceVotes: p.firstPlaceVotes,
    finalPosition: p.finalPosition,
    status: (p.tied ? "TIED" : "PROVISIONAL") as "TIED" | "PROVISIONAL"
  }));
}

describe("E2E dominio: pre-pista → FA → F1 → F2 → desempate → oficial", () => {
  it("3 jueces: FA→F1→F2→desempate 5.e→cierre oficial reescrito", () => {
    const participants: Participant[] = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i + 1}`,
      status: "ELIGIBLE"
    }));

    // Pre-pista: todos aprobados (checkeo veterinario es control manual auditado).
    expect(participants.filter((p) => p.status === "ELIGIBLE")).toHaveLength(10);

    const fa = survivorsFromVotes(
      participants,
      ["j1", "j2", "j3"].map(() => ({ selected: participants.map((p) => p.id) }))
    );
    expect(resolveNextRoundType("FA_CONSOLIDATED", fa.length)).toBe("F1");

    const f1 = survivorsFromVotes(
      participants,
      ["j1", "j2", "j3"].map(() => ({
        selected: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"]
      }))
    );
    expect(f1).toHaveLength(7);
    expect(resolveNextRoundType("F1_CONSOLIDATED", f1.length)).toBe("F2");

    const eligible = f1;
    const f2 = computeF2(
      [
        rankingCard("j1", [["p1", 1], ["p2", 2], ["p3", 3], ["p4", 4], ["p5", 5]], eligible),
        rankingCard("j2", [["p1", 1], ["p2", 2], ["p3", 3], ["p4", 4], ["p6", 5]], eligible),
        rankingCard("j3", [["p1", 1], ["p2", 2], ["p3", 3], ["p4", 4], ["p7", 5]], eligible)
      ],
      3
    );
    const fifth = f2.tiedGroups.find((g) => g.reason === "FIFTH_PLACE_EXCEPTION_5E");
    expect(fifth?.participantIds.sort()).toEqual(["p5", "p6", "p7"]);

    const tb1 = computeF2(
      [
        rankingCard("j1", [["p6", 1], ["p5", 2], ["p7", 3]], ["p5", "p6", "p7"]),
        rankingCard("j2", [["p6", 1], ["p5", 2], ["p7", 3]], ["p5", "p6", "p7"]),
        rankingCard("j3", [["p6", 1], ["p5", 2], ["p7", 3]], ["p5", "p6", "p7"])
      ],
      3,
      "TIE_BREAK"
    );
    expect(tb1.hasBlockingTie).toBe(false);
    expect(tb1.majorityWinnerId).toBe("p6");

    const official = mergeTieBreaksIntoOfficialF2(
      toProvisional(f2),
      tb1.participants.map((p) => ({
        participantId: p.participantId,
        finalPosition: fifth!.startPosition + p.finalPosition - 1,
        sequence: 1
      }))
    );

    expect(
      validateOfficialClosePositions({
        results: official,
        outcomePositions: [
          ...f2.desertedResults.map((r) => r.finalPosition),
          
        ]
      })
    ).toEqual([]);
    expect(official.every((r) => r.status === "FINAL")).toBe(true);
    expect(official.find((r) => r.participantId === "p6")?.finalPosition).toBe(5);
    expect(official.find((r) => r.participantId === "p5")?.finalPosition).toBe(6);
    expect(official.find((r) => r.participantId === "p7")?.finalPosition).toBe(7);
  });

  it("3 jueces: empate por suma → segundo desempate → oficial", () => {
    const eligible = ["A", "B", "C"];
    const f2 = computeF2(
      [
        rankingCard("j1", [["A", 1], ["B", 2], ["C", 3]], eligible),
        rankingCard("j2", [["B", 1], ["A", 2], ["C", 3]], eligible),
        rankingCard("j3", [["C", 1], ["A", 2], ["B", 3]], eligible)
      ],
      3
    );
    // Empate A/B: en F2 la adjudicación por puesto deja 1.º/2.º desiertos y el residual
    // no bloquea. El desempate por suma relativa sí puede empatar y requerir reintento.
    const f2Tie = computeF2(
      [rankingCard("j1", [["A", 1], ["B", 2]], ["A", "B"]), rankingCard("j2", [["B", 1], ["A", 2]], ["A", "B"])],
      2,
      "TIE_BREAK"
    );
    expect(f2Tie.hasBlockingTie).toBe(true);

    // Primer desempate empatado; segundo resuelve.
    const tb1 = computeF2(
      [rankingCard("j1", [["A", 1], ["B", 2]], ["A", "B"]), rankingCard("j2", [["B", 1], ["A", 2]], ["A", "B"])],
      2,
      "TIE_BREAK"
    );
    expect(tb1.hasBlockingTie).toBe(true);

    const tb2 = computeF2(
      [
        rankingCard("j1", [["A", 1], ["B", 2]], ["A", "B"]),
        rankingCard("j2", [["A", 1], ["B", 2]], ["A", "B"]),
        rankingCard("j3", [["A", 1], ["B", 2]], ["A", "B"])
      ],
      3,
      "TIE_BREAK"
    );
    expect(tb2.hasBlockingTie).toBe(false);

    const block = f2Tie.tiedGroups[0]!;
    const official = mergeTieBreaksIntoOfficialF2(
      toProvisional(f2Tie),
      tb2.participants.map((p) => ({
        participantId: p.participantId,
        finalPosition: block.startPosition + p.finalPosition - 1,
        sequence: 2
      }))
    );
    expect(validateOfficialClosePositions({ results: official, outcomePositions: [] })).toEqual(
      []
    );
    expect(official.map((r) => [r.participantId, r.finalPosition, r.status])).toEqual([
      ["A", 1, "FINAL"],
      ["B", 2, "FINAL"]
    ]);
    void f2;
  });

  it("5 jueces: FA≤8 → F2 directo → cierre oficial", () => {
    const participants: Participant[] = Array.from({ length: 8 }, (_, i) => ({
      id: `p${i + 1}`,
      status: "ELIGIBLE"
    }));
    const fa = survivorsFromVotes(
      participants,
      ["j1", "j2", "j3", "j4", "j5"].map(() => ({
        selected: participants.map((p) => p.id)
      }))
    );
    expect(resolveNextRoundType("FA_CONSOLIDATED", fa.length)).toBe("F2");

    const f2 = computeF2(
      [
        rankingCard("j1", [["p1", 1], ["p2", 2], ["p3", 3], ["p4", 4], ["p5", 5]], fa),
        rankingCard("j2", [["p1", 1], ["p2", 2], ["p3", 3], ["p4", 4], ["p5", 5]], fa),
        rankingCard("j3", [["p1", 1], ["p3", 2], ["p2", 3], ["p4", 4], ["p5", 5]], fa),
        rankingCard("j4", [["p2", 1], ["p1", 2], ["p3", 3], ["p4", 4], ["p5", 5]], fa),
        rankingCard("j5", [["p2", 1], ["p3", 2], ["p1", 3], ["p4", 4], ["p5", 5]], fa)
      ],
      5
    );
    expect(f2.majorityWinnerId).toBe("p1");
    expect(f2.hasBlockingTie).toBe(false);

    const official = mergeTieBreaksIntoOfficialF2(toProvisional(f2), []);
    expect(
      validateOfficialClosePositions({
        results: official,
        outcomePositions: [
          ...f2.desertedResults.map((r) => r.finalPosition),
          
        ]
      })
    ).toEqual([]);
    expect(official.every((r) => r.status === "FINAL")).toBe(true);
    expect(official.find((r) => r.participantId === "p1")?.finalPosition).toBe(1);
    expect(f2.desertedResults.some((row) => row.finalPosition === 2)).toBe(true);
  });

  it("5 jueces: 5.e con quintos distintos → desempate → oficial", () => {
    const eligible = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
    const f2 = computeF2(
      [
        rankingCard("j1", [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["E", 5]], eligible),
        rankingCard("j2", [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["F", 5]], eligible),
        rankingCard("j3", [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["G", 5]], eligible),
        rankingCard("j4", [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["H", 5]], eligible),
        rankingCard("j5", [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["I", 5]], eligible)
      ],
      5
    );
    const fifth = f2.tiedGroups.find((g) => g.reason === "FIFTH_PLACE_EXCEPTION_5E");
    expect(fifth?.participantIds.sort()).toEqual(["E", "F", "G", "H", "I"]);

    const tb = computeF2(
      [
        rankingCard("j1", [["E", 1], ["F", 2], ["G", 3], ["H", 4], ["I", 5]], fifth!.participantIds),
        rankingCard("j2", [["E", 1], ["F", 2], ["G", 3], ["H", 4], ["I", 5]], fifth!.participantIds),
        rankingCard("j3", [["E", 1], ["F", 2], ["G", 3], ["H", 4], ["I", 5]], fifth!.participantIds),
        rankingCard("j4", [["E", 1], ["F", 2], ["G", 3], ["H", 4], ["I", 5]], fifth!.participantIds),
        rankingCard("j5", [["E", 1], ["F", 2], ["G", 3], ["H", 4], ["I", 5]], fifth!.participantIds)
      ],
      5,
      "TIE_BREAK"
    );
    expect(tb.hasBlockingTie).toBe(false);

    const official = mergeTieBreaksIntoOfficialF2(
      toProvisional(f2),
      tb.participants.map((p) => ({
        participantId: p.participantId,
        finalPosition: fifth!.startPosition + p.finalPosition - 1,
        sequence: 1
      }))
    );
    expect(validateOfficialClosePositions({ results: official, outcomePositions: [] })).toEqual(
      []
    );
    expect(official.find((r) => r.participantId === "E")?.finalPosition).toBe(5);
    expect(official.find((r) => r.participantId === "I")?.finalPosition).toBe(9);
    expect(official.every((r) => r.status === "FINAL")).toBe(true);
  });
});
