import { describe, expect, it } from "vitest";
import { resolveNextRoundType } from "./flow-rules.js";
import { computeF2, type JudgeCard } from "./scoring.js";

type ScenarioParticipant = {
  id: string;
  status: "ELIGIBLE" | "DISQUALIFIED";
};

type FaSelection = {
  judgeId: string;
  selectedParticipantIds: string[];
};

function consolidateFaScenario(
  participants: ScenarioParticipant[],
  cards: FaSelection[]
): Array<{ participantId: string; votes: number }> {
  const eligibleIds = new Set(
    participants.filter((participant) => participant.status === "ELIGIBLE").map((participant) => participant.id)
  );
  const votes = new Map<string, number>();
  for (const card of cards) {
    for (const participantId of new Set(card.selectedParticipantIds)) {
      if (!eligibleIds.has(participantId)) continue;
      votes.set(participantId, (votes.get(participantId) ?? 0) + 1);
    }
  }
  return [...votes.entries()]
    .map(([participantId, voteCount]) => ({ participantId, votes: voteCount }))
    .sort((a, b) => b.votes - a.votes || a.participantId.localeCompare(b.participantId));
}

function consolidateF1Scenario(
  participants: ScenarioParticipant[],
  cards: FaSelection[]
): string[] {
  return consolidateFaScenario(participants, cards).map((result) => result.participantId);
}

function rankingCard(
  judgeUserId: string,
  positions: Array<[participantId: string, position: number]>,
  eligibleParticipantIds: string[],
  desertedPositions: number[] = []
): JudgeCard {
  return {
    judgeUserId,
    positions: positions.map(([participantId, position]) => ({ participantId, position })),
    desertedPositions,
    eligibleParticipantIds
  };
}

function officialTieBreakPositions(
  cards: JudgeCard[],
  startPosition: number
): Map<string, number> {
  const scoring = computeF2(cards, cards.length);
  if (scoring.hasBlockingTie) {
    throw new Error("El escenario de desempate todavía no produjo una decisión.");
  }
  return new Map(
    scoring.participants.map((participant) => [
      participant.participantId,
      startPosition + participant.finalPosition - 1
    ])
  );
}

describe("escenarios integrados del dominio FA → F1/F2 → desempate", () => {
  it("declara el flujo sin siguiente ronda cuando FA no conserva sobrevivientes", () => {
    const participants: ScenarioParticipant[] = [
      { id: "p1", status: "ELIGIBLE" },
      { id: "p2", status: "DISQUALIFIED" }
    ];
    const fa = consolidateFaScenario(participants, [
      { judgeId: "j1", selectedParticipantIds: ["p2"] },
      { judgeId: "j2", selectedParticipantIds: [] },
      { judgeId: "j3", selectedParticipantIds: [] }
    ]);

    expect(fa).toHaveLength(0);
    expect(() => resolveNextRoundType("FA_CONSOLIDATED", fa.length)).toThrow(
      "No hay ejemplares sobrevivientes"
    );
  });

  it("excluye descalificados en FA y pasa directamente a F2 con hasta 8 sobrevivientes", () => {
    const participants: ScenarioParticipant[] = [
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `p${index + 1}`,
        status: "ELIGIBLE" as const
      })),
      { id: "p7", status: "DISQUALIFIED" }
    ];
    const fa = consolidateFaScenario(participants, [
      { judgeId: "j1", selectedParticipantIds: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"] },
      { judgeId: "j2", selectedParticipantIds: ["p1", "p2", "p3", "p4", "p5", "p6"] },
      { judgeId: "j3", selectedParticipantIds: ["p1", "p2", "p3", "p4", "p5", "p6"] }
    ]);

    expect(fa.map((result) => result.participantId)).not.toContain("p7");
    expect(fa).toHaveLength(6);
    expect(resolveNextRoundType("FA_CONSOLIDATED", fa.length)).toBe("F2");

    const eligible = fa.map((result) => result.participantId);
    const f2 = computeF2(
      [
        rankingCard("j1", [["p1", 1], ["p2", 2], ["p3", 3], ["p4", 4], ["p5", 5]], eligible),
        rankingCard("j2", [["p1", 1], ["p2", 2], ["p3", 3], ["p4", 4], ["p5", 5]], eligible),
        rankingCard("j3", [["p1", 1], ["p2", 2], ["p3", 3], ["p4", 4], ["p5", 5]], eligible)
      ],
      3
    );

    expect(f2.hasBlockingTie).toBe(false);
    expect(f2.participants.find((participant) => participant.participantId === "p1")?.finalPosition).toBe(1);
    expect(f2.participants.find((participant) => participant.participantId === "p6")?.finalPosition).toBe(6);
  });

  it("pasa por F1 con más de 8 sobrevivientes y resuelve un empate completo por puestos 3 a 5", () => {
    const participants: ScenarioParticipant[] = [
      ...Array.from({ length: 9 }, (_, index) => ({
        id: `p${index + 1}`,
        status: "ELIGIBLE" as const
      })),
      { id: "p10", status: "DISQUALIFIED" }
    ];
    const faCards: FaSelection[] = ["j1", "j2", "j3"].map((judgeId) => ({
      judgeId,
      selectedParticipantIds: participants.map((participant) => participant.id)
    }));
    const fa = consolidateFaScenario(participants, faCards);

    expect(fa).toHaveLength(9);
    expect(resolveNextRoundType("FA_CONSOLIDATED", fa.length)).toBe("F1");

    const f1Cards: FaSelection[] = ["j1", "j2", "j3"].map((judgeId) => ({
      judgeId,
      selectedParticipantIds: ["p1", "p2", "p3", "p4", "p5", "p6", "p7"]
    }));
    const f1Survivors = consolidateF1Scenario(participants, f1Cards);
    expect(f1Survivors).toEqual(["p1", "p2", "p3", "p4", "p5", "p6", "p7"]);
    expect(resolveNextRoundType("F1_CONSOLIDATED", f1Survivors.length)).toBe("F2");

    const f2 = computeF2(
      [
        rankingCard("j2", [["p1", 1], ["p2", 3], ["p5", 4], ["p7", 5]], f1Survivors, [2]),
        rankingCard("j3", [["p4", 1], ["p5", 2], ["p6", 3], ["p3", 4], ["p7", 5]], f1Survivors),
        rankingCard("j1", [["p1", 1], ["p3", 2], ["p2", 3], ["p4", 4], ["p6", 5]], f1Survivors)
      ],
      3
    );
    const blockingGroup = f2.tiedGroups.find(
      (group) => group.reason === "SUM_EQUALITY" && group.positionSum === 12
    );

    expect(blockingGroup?.participantIds.sort()).toEqual(["p2", "p3", "p5"]);
    expect(blockingGroup?.startPosition).toBe(3);
    expect(blockingGroup?.endPosition).toBe(5);
    expect(f2.tiedGroups.some((group) => group.reason === "FIFTH_PLACE_EXCEPTION_5E")).toBe(false);

    const resolved = officialTieBreakPositions(
      [
        rankingCard("j1", [["p2", 3], ["p3", 4], ["p5", 5]], ["p2", "p3", "p5"]),
        rankingCard("j2", [["p2", 3], ["p3", 4], ["p5", 5]], ["p2", "p3", "p5"]),
        rankingCard("j3", [["p2", 3], ["p3", 4], ["p5", 5]], ["p2", "p3", "p5"])
      ],
      3
    );

    expect(Object.fromEntries(resolved)).toEqual({ p2: 3, p3: 4, p5: 5 });
  });

  it("excluye de F1 un ejemplar descalificado después de haber sobrevivido al FA", () => {
    const participants = Array.from({ length: 9 }, (_, index): ScenarioParticipant => ({
      id: `p${index + 1}`,
      status: "ELIGIBLE"
    }));
    const faCards: FaSelection[] = ["j1", "j2", "j3"].map((judgeId) => ({
      judgeId,
      selectedParticipantIds: participants.map((participant) => participant.id)
    }));
    const fa = consolidateFaScenario(participants, faCards);
    expect(resolveNextRoundType("FA_CONSOLIDATED", fa.length)).toBe("F1");

    const participantsAtF1 = participants.map((participant) =>
      participant.id === "p9" ? { ...participant, status: "DISQUALIFIED" as const } : participant
    );
    const f1 = consolidateF1Scenario(
      participantsAtF1,
      ["j1", "j2", "j3"].map((judgeId) => ({
        judgeId,
        selectedParticipantIds: ["p1", "p2", "p3", "p4", "p5", "p6", "p9"]
      }))
    );

    expect(f1).toEqual(["p1", "p2", "p3", "p4", "p5", "p6"]);
    expect(f1).not.toContain("p9");
    expect(resolveNextRoundType("F1_CONSOLIDATED", f1.length)).toBe("F2");
  });

  it("no activa 5.e cuando dos jueces coinciden en quinto", () => {
    const eligible = ["A", "B", "C", "D", "E", "F"];
    const result = computeF2(
      [
        rankingCard("j1", [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["E", 5]], eligible),
        rankingCard("j2", [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["E", 5]], eligible),
        rankingCard("j3", [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["F", 5]], eligible)
      ],
      3
    );

    expect(result.tiedGroups.some((group) => group.reason === "FIFTH_PLACE_EXCEPTION_5E")).toBe(false);
  });

  it("activa 5.e con tres quintos distintos y el desempate define un único quinto", () => {
    const eligible = ["A", "B", "C", "D", "E", "F", "G"];
    const result = computeF2(
      [
        rankingCard("j1", [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["E", 5]], eligible),
        rankingCard("j2", [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["F", 5]], eligible),
        rankingCard("j3", [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["G", 5]], eligible)
      ],
      3
    );
    const special = result.tiedGroups.find(
      (group) => group.reason === "FIFTH_PLACE_EXCEPTION_5E"
    );

    expect(special?.participantIds.sort()).toEqual(["E", "F", "G"]);
    expect([special?.startPosition, special?.endPosition]).toEqual([5, 7]);

    const resolved = officialTieBreakPositions(
      [
        rankingCard("j1", [["F", 5], ["E", 6], ["G", 7]], ["E", "F", "G"]),
        rankingCard("j2", [["F", 5], ["E", 6], ["G", 7]], ["E", "F", "G"]),
        rankingCard("j3", [["F", 5], ["E", 6], ["G", 7]], ["E", "F", "G"])
      ],
      5
    );

    expect(Object.fromEntries(resolved)).toEqual({ F: 5, E: 6, G: 7 });
  });

  it("mantiene pendiente un desempate que vuelve a quedar igualado y permite resolverlo después", () => {
    const eligible = ["A", "B"];
    const firstAttempt = computeF2(
      [
        rankingCard("j1", [["A", 3], ["B", 4]], eligible),
        rankingCard("j2", [["B", 3], ["A", 4]], eligible)
      ],
      2
    );

    expect(firstAttempt.hasBlockingTie).toBe(true);
    expect(firstAttempt.tiedGroups[0]?.participantIds.sort()).toEqual(["A", "B"]);

    const resolved = officialTieBreakPositions(
      [
        rankingCard("j1", [["A", 3], ["B", 4]], eligible),
        rankingCard("j2", [["A", 3], ["B", 4]], eligible)
      ],
      3
    );
    expect(Object.fromEntries(resolved)).toEqual({ A: 3, B: 4 });
  });

  it("no bloquea el cierre por una igualdad completamente ubicada desde el sexto puesto", () => {
    const eligible = ["A", "B", "C", "D", "E", "F", "G"];
    const result = computeF2(
      [
        rankingCard(
          "j1",
          [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["E", 5], ["F", 6], ["G", 7]],
          eligible
        ),
        rankingCard(
          "j2",
          [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["E", 5], ["G", 6], ["F", 7]],
          eligible
        )
      ],
      2
    );

    expect(result.tiedGroups.find((group) => group.participantIds.includes("F"))?.startPosition).toBe(6);
    expect(result.hasBlockingTie).toBe(false);
  });
});
