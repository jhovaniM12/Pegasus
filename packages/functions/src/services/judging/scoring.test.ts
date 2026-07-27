import { describe, expect, it } from "vitest";
import { computeF2, majorityThreshold, type JudgeCard } from "./scoring.js";

/**
 * Construye una tarjeta de juez donde el juez puntúa a todos los participantes indicados en orden.
 * Los participantes extra (extraEligible) están en el formulario pero el juez NO les asignó posición
 * → recibirán voto de castigo al consolidar.
 */
function card(judgeUserId: string, orderedParticipantIds: string[], extraEligible: string[] = []): JudgeCard {
  return {
    judgeUserId,
    positions: orderedParticipantIds.map((participantId, index) => ({
      participantId,
      position: index + 1
    })),
    desertedPositions: [],
    eligibleParticipantIds: [...orderedParticipantIds, ...extraEligible]
  };
}

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

function positionOf(result: ReturnType<typeof computeF2>, participantId: string): number | undefined {
  return result.participants.find((p) => p.participantId === participantId)?.finalPosition;
}

function sumOf(result: ReturnType<typeof computeF2>, participantId: string): number | undefined {
  return result.participants.find((p) => p.participantId === participantId)?.positionSum;
}

function cardsOf(result: ReturnType<typeof computeF2>, participantId: string): number | undefined {
  return result.participants.find((p) => p.participantId === participantId)?.cardsCount;
}

function desertedAt(result: ReturnType<typeof computeF2>, finalPosition: number) {
  return result.desertedResults.find((row) => row.finalPosition === finalPosition);
}

describe("majorityThreshold", () => {
  it("calcula la mayoría simple según el número de jueces", () => {
    expect(majorityThreshold(1)).toBe(1);
    expect(majorityThreshold(2)).toBe(2);
    expect(majorityThreshold(3)).toBe(2);
    expect(majorityThreshold(5)).toBe(3);
  });
});

describe("QA-F2-002 - consideración por tarjetas y suma", () => {
  it("consolida el escenario QA-F2-002 sin desiertos ni desempate", () => {
    // Tarjetas coherentes del defecto de producción (planilla del juez):
    // #1: 1,6,1=8 (2/3, mayoría de 1.º) · #2: 2,1,2=5 · #3: 3,2,3=8 · #4: 5,3,4=12 · #5: 4,4,5=13
    const eligible = ["h1", "h2", "h3", "h4", "h5"];
    const cards: JudgeCard[] = [
      rankingCard(
        "j1",
        [
          ["h1", 1],
          ["h2", 2],
          ["h3", 3],
          ["h5", 4],
          ["h4", 5]
        ],
        eligible
      ),
      rankingCard(
        "j2",
        [
          ["h2", 1],
          ["h3", 2],
          ["h4", 3],
          ["h5", 4]
        ],
        eligible
      ),
      rankingCard(
        "j3",
        [
          ["h1", 1],
          ["h2", 2],
          ["h3", 3],
          ["h4", 4],
          ["h5", 5]
        ],
        eligible
      )
    ];

    const result = computeF2(cards, 3);

    expect(result.majorityWinnerId).toBe("h1");
    expect(positionOf(result, "h1")).toBe(1);
    expect(positionOf(result, "h2")).toBe(2);
    expect(positionOf(result, "h3")).toBe(3);
    expect(positionOf(result, "h4")).toBe(4);
    expect(positionOf(result, "h5")).toBe(5);

    expect(sumOf(result, "h1")).toBe(8);
    expect(sumOf(result, "h2")).toBe(5);
    expect(sumOf(result, "h3")).toBe(8);
    expect(sumOf(result, "h4")).toBe(12);
    expect(sumOf(result, "h5")).toBe(13);

    expect(cardsOf(result, "h1")).toBe(2);
    expect(cardsOf(result, "h2")).toBe(3);
    expect(cardsOf(result, "h3")).toBe(3);
    expect(cardsOf(result, "h4")).toBe(3);
    expect(cardsOf(result, "h5")).toBe(3);

    expect(result.desertedResults).toEqual([]);
    expect(result.hasBlockingTie).toBe(false);
    expect(result.hasTie).toBe(false);
  });
});

describe("computeF2 - consideración mínima por tarjetas", () => {
  it("consideración 2 de 3 en posiciones diferentes sigue siendo premiable", () => {
    const eligible = ["A", "B"];
    const cards: JudgeCard[] = [
      rankingCard("j1", [["A", 3], ["B", 1]], eligible),
      rankingCard("j2", [["A", 4], ["B", 2]], eligible),
      rankingCard("j3", [["B", 1]], eligible, [3, 4, 5])
    ];
    // A: 3+4+6=13, cards=2 → premiable; B: 1+2+1=4, cards=3, firsts=2 → mayoría
    const result = computeF2(cards, 3);
    expect(cardsOf(result, "A")).toBe(2);
    expect(positionOf(result, "B")).toBe(1);
    expect(positionOf(result, "A")).toBe(2);
    expect(desertedAt(result, 1)).toBeUndefined();
  });

  it("consideración 3 de 5 en posiciones diferentes sigue siendo premiable", () => {
    const eligible = ["A"];
    const cards: JudgeCard[] = [
      rankingCard("j1", [["A", 1]], eligible),
      rankingCard("j2", [["A", 3]], eligible),
      rankingCard("j3", [["A", 5]], eligible),
      rankingCard("j4", [], eligible, [1, 2, 3, 4, 5]),
      rankingCard("j5", [], eligible, [1, 2, 3, 4, 5])
    ];
    // A: cards=3 ≥ 3 → premiable; puestos 1 y 2 no tienen mayoría de desierto (2/5)
    const result = computeF2(cards, 5);
    expect(cardsOf(result, "A")).toBe(3);
    expect(positionOf(result, "A")).toBe(1);
    expect(desertedAt(result, 1)).toBeUndefined();
  });

  it("ejemplar considerado por un solo juez no es premiable", () => {
    const result = computeF2(
      [
        rankingCard("j1", [["X", 1]], ["X"]),
        rankingCard("j2", [], ["X"]),
        rankingCard("j3", [], ["X"])
      ],
      3
    );
    expect(cardsOf(result, "X")).toBe(1);
    expect(positionOf(result, "X")).toBe(6);
    expect(desertedAt(result, 1)?.reason).toBe("INSUFFICIENT_CONSIDERATION");
    expect(desertedAt(result, 1)?.assignedVotes).toBe(1);
    expect(desertedAt(result, 1)?.minimumRequired).toBe(2);
  });

  it("adjudica por suma cuando hay consideración suficiente aunque no coincidan en el mismo puesto", () => {
    const cards = [
      card("j1", ["A", "B", "C"]),
      card("j2", ["A", "B", "C"]),
      card("j3", ["A", "B", "C"])
    ];
    const result = computeF2(cards, 3);
    expect(positionOf(result, "A")).toBe(1);
    expect(positionOf(result, "B")).toBe(2);
    expect(positionOf(result, "C")).toBe(3);
    expect(desertedAt(result, 4)?.reason).toBe("NO_ASSIGNMENTS");
    expect(desertedAt(result, 5)?.reason).toBe("NO_ASSIGNMENTS");
  });
});

describe("computeF2 - puestos desiertos por mayoría explícita", () => {
  it("puesto vacío por un solo juez con tres jueces: no hay mayoría de desierto", () => {
    const eligible = ["A", "B"];
    const cards: JudgeCard[] = [
      rankingCard("j1", [["A", 2], ["B", 3]], eligible, [1]),
      rankingCard("j2", [["A", 1], ["B", 2]], eligible),
      rankingCard("j3", [["A", 1], ["B", 2]], eligible)
    ];
    const result = computeF2(cards, 3);
    expect(desertedAt(result, 1)).toBeUndefined();
    expect(positionOf(result, "A")).toBe(1);
    expect(positionOf(result, "B")).toBe(2);
  });

  it("puesto vacío por dos de tres jueces: queda desierto EXPLICIT_MAJORITY", () => {
    const eligible = ["A", "B", "C", "D", "E"];
    const result = computeF2(
      [
        rankingCard("j1", [["A", 1], ["B", 2], ["C", 3], ["D", 4]], eligible, [5]),
        rankingCard("j2", [["A", 1], ["B", 2], ["C", 3], ["D", 4]], eligible, [5]),
        rankingCard("j3", [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["E", 5]], eligible)
      ],
      3
    );
    expect(desertedAt(result, 5)).toEqual({
      finalPosition: 5,
      reason: "EXPLICIT_MAJORITY",
      assignedVotes: 1,
      minimumRequired: 2,
      desertedVotes: 2
    });
    expect(positionOf(result, "E")).toBe(6);
  });

  it("puesto vacío por tres de cinco jueces: queda desierto EXPLICIT_MAJORITY", () => {
    const eligible = ["A"];
    const result = computeF2(
      [
        rankingCard("j1", [["A", 1]], eligible),
        rankingCard("j2", [["A", 1]], eligible),
        rankingCard("j3", [], eligible, [1]),
        rankingCard("j4", [], eligible, [1]),
        rankingCard("j5", [], eligible, [1])
      ],
      5
    );
    expect(desertedAt(result, 1)).toMatchObject({
      reason: "EXPLICIT_MAJORITY",
      desertedVotes: 3,
      assignedVotes: 2,
      minimumRequired: 3
    });
    expect(cardsOf(result, "A")).toBe(2);
    expect(positionOf(result, "A")).toBe(6);
  });

  it("todos dejan vacío → desierto con votos derivados", () => {
    const cards: JudgeCard[] = [1, 2, 3].map((n) => ({
      judgeUserId: `j${n}`,
      positions: [
        { participantId: "A", position: 1 },
        { participantId: "B", position: 2 },
        { participantId: "C", position: 3 }
      ],
      desertedPositions: [4, 5],
      eligibleParticipantIds: ["A", "B", "C"]
    }));
    const result = computeF2(cards, 3);
    expect(desertedAt(result, 4)).toEqual({
      finalPosition: 4,
      desertedVotes: 3,
      assignedVotes: 0,
      minimumRequired: 2,
      reason: "EXPLICIT_MAJORITY"
    });
  });

  it("no compacta alrededor de un puesto con mayoría de desierto", () => {
    const allEligible = ["h1", "h2", "h3", "h4"];
    const cards: JudgeCard[] = [
      rankingCard("j1", [["h1", 2]], allEligible, [1, 3, 4, 5]),
      rankingCard("j2", [["h1", 2]], allEligible, [1, 3, 4, 5]),
      rankingCard("j3", [], allEligible, [1, 2, 3, 4, 5])
    ];
    const result = computeF2(cards, 3);
    expect(desertedAt(result, 1)?.reason).toBe("EXPLICIT_MAJORITY");
    expect(positionOf(result, "h1")).toBe(2);
    expect(sumOf(result, "h1")).toBe(10);
    expect(cardsOf(result, "h1")).toBe(2);
    expect(result.desertedResults.map((row) => row.finalPosition)).toEqual([1, 3, 4, 5]);
    expect(result.hasBlockingTie).toBe(false);
  });
});

describe("computeF2 - puestos vacíos sin premiables", () => {
  it("puesto vacío sin ejemplares premiables disponibles → NO_ASSIGNMENTS", () => {
    const result = computeF2(
      [
        rankingCard("j1", [["A", 1]], ["A"]),
        rankingCard("j2", [["A", 1]], ["A"]),
        rankingCard("j3", [["A", 1]], ["A"])
      ],
      3
    );
    expect(positionOf(result, "A")).toBe(1);
    expect(desertedAt(result, 4)).toMatchObject({
      reason: "NO_ASSIGNMENTS",
      assignedVotes: 0,
      minimumRequired: 2
    });
    expect(desertedAt(result, 5)?.reason).toBe("NO_ASSIGNMENTS");
  });

  it("cinco puestos visibles con menos de cinco participantes", () => {
    const result = computeF2([card("j1", ["A", "B"])], 1);
    expect(positionOf(result, "A")).toBe(1);
    expect(positionOf(result, "B")).toBe(2);
    expect(result.desertedResults.map((row) => row.finalPosition)).toEqual([3, 4, 5]);
    expect(result.desertedResults.every((row) => row.reason === "NO_ASSIGNMENTS")).toBe(true);
  });
});

describe("computeF2 - mayoría de primeros y empates", () => {
  it("mayoría de primeros prevalece sobre la suma", () => {
    const cards = [
      card("j1", ["A", "B", "C"]),
      card("j2", ["A", "B", "C"]),
      card("j3", ["B", "C", "A"])
    ];
    // A: 1+1+3=5, firsts=2; B: 2+2+1=5 — A gana el 1.º por mayoría aunque la suma empate
    const result = computeF2(cards, 3);
    expect(result.majorityWinnerId).toBe("A");
    expect(positionOf(result, "A")).toBe(1);
    expect(positionOf(result, "B")).toBe(2);
  });

  it("empate por suma entre premiables requiere desempate", () => {
    const cards = [card("j1", ["A", "B"]), card("j2", ["B", "A"])];
    const result = computeF2(cards, 2);
    expect(result.majorityWinnerId).toBeNull();
    expect(result.hasBlockingTie).toBe(true);
    expect(result.tiedGroups).toEqual([
      expect.objectContaining({
        reason: "SUM_EQUALITY",
        participantIds: expect.arrayContaining(["A", "B"]),
        positionSum: 3,
        startPosition: 1,
        endPosition: 2,
        blocksClosure: true
      })
    ]);
  });
});

describe("computeF2 - voto de castigo y suma", () => {
  it("aplica penalización a participantes no puntuados por un juez", () => {
    const cards = [
      card("j1", ["A", "B"], ["C"]),
      card("j2", ["A", "B", "C"]),
      card("j3", ["A", "B", "C"])
    ];
    const result = computeF2(cards, 3);
    expect(positionOf(result, "A")).toBe(1);
    expect(positionOf(result, "B")).toBe(2);
    expect(sumOf(result, "A")).toBe(3);
    expect(sumOf(result, "B")).toBe(6);
    expect(sumOf(result, "C")).toBe(12);
    expect(cardsOf(result, "C")).toBe(2);
    expect(positionOf(result, "C")).toBe(3);
  });

  it("ordena por suma a premiables aunque no coincidan en el mismo puesto exacto", () => {
    const allEligible = ["p5", "p6", "p3", "p7", "p1", "p8", "p14", "p2"];
    const cards: JudgeCard[] = [
      rankingCard("j1", [["p7", 1], ["p8", 3]], allEligible),
      rankingCard(
        "j2",
        [
          ["p5", 1],
          ["p6", 2],
          ["p3", 3],
          ["p1", 4],
          ["p2", 5]
        ],
        allEligible
      ),
      rankingCard(
        "j3",
        [
          ["p5", 1],
          ["p6", 2],
          ["p3", 3],
          ["p14", 4],
          ["p1", 5]
        ],
        allEligible
      )
    ];

    const result = computeF2(cards, 3);
    expect(sumOf(result, "p5")).toBe(8);
    expect(sumOf(result, "p6")).toBe(10);
    expect(sumOf(result, "p3")).toBe(12);
    expect(sumOf(result, "p1")).toBe(15);
    expect(positionOf(result, "p5")).toBe(1);
    expect(positionOf(result, "p6")).toBe(2);
    expect(positionOf(result, "p3")).toBe(3);
    expect(positionOf(result, "p1")).toBe(4);
    // p7/p8/p14/p2 solo tienen 1 tarjeta → no premiables; el 5.º queda insuficiente.
    expect(desertedAt(result, 5)?.reason).toBe("INSUFFICIENT_CONSIDERATION");
    expect(desertedAt(result, 5)?.assignedVotes).toBe(1);
    expect(result.hasBlockingTie).toBe(false);
  });

  it("cardsCount refleja el número real de jueces que asignaron puesto", () => {
    const result = computeF2(
      [card("j1", ["A", "B"], ["C"]), card("j2", ["A", "C", "B"]), card("j3", ["A", "B", "C"])],
      3
    );
    expect(cardsOf(result, "A")).toBe(3);
    expect(cardsOf(result, "C")).toBe(2);
  });
});

describe("computeF2 - excepción 5.e", () => {
  it("declara DESERTED el quinto cuando todos lo dejan vacío", () => {
    const allEligible = ["A", "B", "C", "D", "E"];
    const cards: JudgeCard[] = [1, 2, 3].map((n) => ({
      judgeUserId: `j${n}`,
      positions: [
        { participantId: "A", position: 1 },
        { participantId: "B", position: 2 },
        { participantId: "C", position: 3 },
        { participantId: "D", position: 4 }
      ],
      desertedPositions: [5],
      eligibleParticipantIds: allEligible
    }));
    const result = computeF2(cards, 3);
    expect(desertedAt(result, 5)).toEqual({
      finalPosition: 5,
      desertedVotes: 3,
      assignedVotes: 0,
      minimumRequired: 2,
      reason: "EXPLICIT_MAJORITY"
    });
  });

  it("no aplica 5.e cuando dos jueces coinciden en el mismo quinto", () => {
    const allEligible = ["A", "B", "C", "G", "E", "F"];
    const result = computeF2(
      [
        card("j1", ["A", "B", "C", "G", "E"], ["F"]),
        card("j2", ["A", "B", "C", "G", "F"], ["E"]),
        card("j3", ["A", "B", "C", "E", "F"], ["G"])
      ],
      3
    );
    expect(positionOf(result, "A")).toBe(1);
    // Por suma: G=14, E=15, F=16 → G 4.º, E 5.º, F residual.
    expect(positionOf(result, "G")).toBe(4);
    expect(positionOf(result, "E")).toBe(5);
    expect(positionOf(result, "F")).toBe(6);
    expect(result.tiedGroups).toHaveLength(0);
    expect(result.hasBlockingTie).toBe(false);
  });

  it("aplica 5.e solo cuando todos los jueces eligen un quinto diferente", () => {
    const allEligible = ["A", "B", "C", "D", "E", "F", "G"];
    const result = computeF2(
      [
        card("j1", ["A", "B", "C", "D", "E"], allEligible),
        card("j2", ["A", "B", "C", "D", "F"], allEligible),
        card("j3", ["A", "B", "C", "D", "G"], allEligible)
      ],
      3
    );
    const fifthTie = result.tiedGroups.find((group) => group.reason === "FIFTH_PLACE_EXCEPTION_5E");
    expect(fifthTie).toBeDefined();
    expect(fifthTie!.participantIds.sort()).toEqual(["E", "F", "G"]);
    expect(fifthTie!.blocksClosure).toBe(true);
    expect(result.hasBlockingTie).toBe(true);
  });

  it("DECISIÓN_OPERATIVA: excluye del 5.e a quienes ya tienen 1º–4º provisional", () => {
    const allEligible = ["A", "B", "C", "D", "E", "F", "G"];
    const cards: JudgeCard[] = [
      rankingCard(
        "j1",
        [
          ["A", 1],
          ["B", 2],
          ["C", 3],
          ["D", 4],
          ["E", 5]
        ],
        allEligible
      ),
      rankingCard(
        "j2",
        [
          ["A", 1],
          ["B", 2],
          ["E", 3],
          ["D", 4],
          ["F", 5]
        ],
        allEligible
      ),
      rankingCard(
        "j3",
        [
          ["A", 1],
          ["B", 2],
          ["E", 3],
          ["D", 4],
          ["G", 5]
        ],
        allEligible
      )
    ];
    const result = computeF2(cards, 3);
    const fifthTie = result.tiedGroups.find((group) => group.reason === "FIFTH_PLACE_EXCEPTION_5E");
    expect(positionOf(result, "E")).toBe(3);
    expect(fifthTie!.participantIds.sort()).toEqual(["F", "G"]);
    expect(fifthTie!.participantIds).not.toContain("E");
  });

  it("no aplica 5.e si falta la selección de quinto de un juez", () => {
    const allEligible = ["A", "B", "C", "D", "E", "F", "G"];
    const result = computeF2(
      [
        card("j1", ["A", "B", "C", "D", "E"], allEligible),
        card("j2", ["A", "B", "C", "D", "F"], allEligible),
        card("j3", ["A", "B", "C", "D"], allEligible)
      ],
      3
    );
    expect(result.tiedGroups.some((group) => group.reason === "FIFTH_PLACE_EXCEPTION_5E")).toBe(false);
  });

  it("no aplica 5.e si un juez declara desierto el quinto", () => {
    const allEligible = ["A", "B", "C", "D", "E", "F"];
    const thirdCard = card("j3", ["A", "B", "C", "D"], allEligible);
    thirdCard.desertedPositions = [5];
    const result = computeF2(
      [
        card("j1", ["A", "B", "C", "D", "E"], allEligible),
        card("j2", ["A", "B", "C", "D", "F"], allEligible),
        thirdCard
      ],
      3
    );
    expect(result.tiedGroups.some((group) => group.reason === "FIFTH_PLACE_EXCEPTION_5E")).toBe(false);
  });
});

describe("computeF2 - casos borde", () => {
  it("sin tarjetas devuelve resultado vacío", () => {
    const result = computeF2([], 3);
    expect(result.participants).toHaveLength(0);
  });

  it("un solo juez adjudica por consideración 1/1", () => {
    const result = computeF2([card("j1", ["A", "B", "C"])], 1);
    expect(positionOf(result, "A")).toBe(1);
    expect(positionOf(result, "C")).toBe(3);
    expect(desertedAt(result, 4)?.reason).toBe("NO_ASSIGNMENTS");
    expect(desertedAt(result, 5)?.reason).toBe("NO_ASSIGNMENTS");
  });

  it("con 5 jueces: 3 votos de tarjeta adjudican aunque el puesto tenga 2 vacíos", () => {
    const allEligible = ["A", "B", "C", "D"];
    const cards: JudgeCard[] = [
      rankingCard("j1", [["A", 1]], allEligible, [2]),
      rankingCard("j2", [["A", 1]], allEligible, [2]),
      rankingCard("j3", [["A", 1]], allEligible, [2]),
      rankingCard("j4", [["C", 1]], allEligible),
      rankingCard("j5", [["C", 1]], allEligible)
    ];
    const result = computeF2(cards, 5);
    expect(positionOf(result, "A")).toBe(1);
    expect(desertedAt(result, 2)).toEqual({
      finalPosition: 2,
      desertedVotes: 3,
      assignedVotes: 0,
      minimumRequired: 3,
      reason: "EXPLICIT_MAJORITY"
    });
    // C solo tiene 2 tarjetas < 3 → no premiable.
    expect(cardsOf(result, "C")).toBe(2);
    expect(positionOf(result, "C")).toBe(6);
  });

  it("idempotencia: consolidar dos veces produce el mismo resultado", () => {
    const cards = [
      rankingCard("j1", [["A", 2]], ["A"], [1, 3, 4, 5]),
      rankingCard("j2", [["A", 2]], ["A"], [1, 3, 4, 5]),
      rankingCard("j3", [], ["A"], [1, 2, 3, 4, 5])
    ];
    const first = computeF2(cards, 3);
    const second = computeF2(cards, 3);
    expect(second.desertedResults).toEqual(first.desertedResults);
    expect(second.participants).toEqual(first.participants);
  });
});

describe("computeF2 - empates residuales por suma", () => {
  it("empate por suma fuera del top 5 no bloquea cierre", () => {
    const allEligible = ["A", "B", "C", "D", "E", "F", "G"];
    const result = computeF2(
      [card("j1", ["A", "B", "C", "D", "E", "F", "G"]), card("j2", ["A", "B", "C", "D", "E", "G", "F"])],
      2
    );
    expect(positionOf(result, "A")).toBe(1);
    expect(positionOf(result, "E")).toBe(5);
    expect(result.hasTie).toBe(true);
    expect(result.hasBlockingTie).toBe(false);
    const tieGroup = result.tiedGroups.find((g) => g.participantIds.includes("F"));
    expect(tieGroup!.startPosition).toBe(6);
    expect(tieGroup!.blocksClosure).toBe(false);
  });

  it("mayoría de primeros no abre empate por suma con quien comparte total", () => {
    const cards = [
      card("j1", ["A", "B", "C"]),
      card("j2", ["A", "B", "C"]),
      card("j3", ["B", "A", "C"])
    ];
    const result = computeF2(cards, 3);
    expect(positionOf(result, "A")).toBe(1);
    expect(positionOf(result, "B")).toBe(2);
    expect(result.tiedGroups.filter((g) => g.reason === "SUM_EQUALITY")).toHaveLength(0);
  });
});
