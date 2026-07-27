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

function positionOf(result: ReturnType<typeof computeF2>, participantId: string): number | undefined {
  return result.participants.find((p) => p.participantId === participantId)?.finalPosition;
}

function sumOf(result: ReturnType<typeof computeF2>, participantId: string): number | undefined {
  return result.participants.find((p) => p.participantId === participantId)?.positionSum;
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

describe("computeF2 - adjudicación por puesto", () => {
  it("adjudica cuando hay consideración mínima por puesto (orden coincidente)", () => {
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
    
    expect(result.hasTie).toBe(false);
  });

  it("no compacta por suma: un ejemplar en 2.º no asciende si el 1.º quedó desierto", () => {
    // Caso 1 del doc AJUSTE_LOGICA_PUESTOS_DESIERTOS_PEGASUS.md
    const allEligible = ["h1", "h2", "h3", "h4"];
    const cards: JudgeCard[] = [
      {
        judgeUserId: "j1",
        positions: [{ participantId: "h1", position: 2 }],
        desertedPositions: [1, 3, 4, 5],
        eligibleParticipantIds: allEligible
      },
      {
        judgeUserId: "j2",
        positions: [{ participantId: "h1", position: 2 }],
        desertedPositions: [1, 3, 4, 5],
        eligibleParticipantIds: allEligible
      },
      {
        judgeUserId: "j3",
        positions: [],
        desertedPositions: [1, 2, 3, 4, 5],
        eligibleParticipantIds: allEligible
      }
    ];

    const result = computeF2(cards, 3);

    expect(desertedAt(result, 1)?.reason).toBe("EXPLICIT_MAJORITY");
    expect(positionOf(result, "h1")).toBe(2);
    expect(sumOf(result, "h1")).toBe(10);
    expect(result.participants.find((p) => p.participantId === "h1")?.cardsCount).toBe(2);
    expect(desertedAt(result, 3)).toBeDefined();
    expect(desertedAt(result, 4)).toBeDefined();
    expect(desertedAt(result, 5)).toBeDefined();
    expect(result.hasBlockingTie).toBe(false);
  });

  it("caso 2: un juez deja vacío y dos coinciden → adjudica el puesto", () => {
    const cards: JudgeCard[] = [
      {
        judgeUserId: "j1",
        positions: [],
        desertedPositions: [1],
        eligibleParticipantIds: ["h2", "h3"]
      },
      {
        judgeUserId: "j2",
        positions: [{ participantId: "h2", position: 1 }],
        desertedPositions: [],
        eligibleParticipantIds: ["h2", "h3"]
      },
      {
        judgeUserId: "j3",
        positions: [{ participantId: "h2", position: 1 }],
        desertedPositions: [],
        eligibleParticipantIds: ["h2", "h3"]
      }
    ];

    const result = computeF2(cards, 3);
    expect(positionOf(result, "h2")).toBe(1);
    expect(desertedAt(result, 1)).toBeUndefined();
  });

  it("caso 3: tres asignaciones distintas sin mayoría → puesto desierto", () => {
    const cards: JudgeCard[] = [
      {
        judgeUserId: "j1",
        positions: [{ participantId: "h1", position: 3 }],
        desertedPositions: [],
        eligibleParticipantIds: ["h1", "h2", "h3"]
      },
      {
        judgeUserId: "j2",
        positions: [{ participantId: "h2", position: 3 }],
        desertedPositions: [],
        eligibleParticipantIds: ["h1", "h2", "h3"]
      },
      {
        judgeUserId: "j3",
        positions: [{ participantId: "h3", position: 3 }],
        desertedPositions: [],
        eligibleParticipantIds: ["h1", "h2", "h3"]
      }
    ];

    const result = computeF2(cards, 3);
    expect(desertedAt(result, 3)?.reason).toBe("INSUFFICIENT_CONSIDERATION");
    
  });

  it("caso 4: todos dejan vacío → desierto con votos derivados", () => {
    const cards: JudgeCard[] = [
      {
        judgeUserId: "j1",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 },
          { participantId: "C", position: 3 }
        ],
        desertedPositions: [4, 5],
        eligibleParticipantIds: ["A", "B", "C"]
      },
      {
        judgeUserId: "j2",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 },
          { participantId: "C", position: 3 }
        ],
        desertedPositions: [4, 5],
        eligibleParticipantIds: ["A", "B", "C"]
      },
      {
        judgeUserId: "j3",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 },
          { participantId: "C", position: 3 }
        ],
        desertedPositions: [4, 5],
        eligibleParticipantIds: ["A", "B", "C"]
      }
    ];

    const result = computeF2(cards, 3);
    expect(desertedAt(result, 4)).toEqual({
      finalPosition: 4,
      desertedVotes: 3,
      assignedVotes: 0,
      minimumRequired: 2,
      reason: "EXPLICIT_MAJORITY"
    });
  });

  it("caso 6: con 5 jueces, 3 votos adjudican y 2 no alcanzan", () => {
    const allEligible = ["A", "B"];
    const awardCards: JudgeCard[] = [
      { judgeUserId: "j1", positions: [{ participantId: "A", position: 1 }], desertedPositions: [], eligibleParticipantIds: allEligible },
      { judgeUserId: "j2", positions: [{ participantId: "A", position: 1 }], desertedPositions: [], eligibleParticipantIds: allEligible },
      { judgeUserId: "j3", positions: [{ participantId: "A", position: 1 }], desertedPositions: [], eligibleParticipantIds: allEligible },
      { judgeUserId: "j4", positions: [], desertedPositions: [1], eligibleParticipantIds: allEligible },
      { judgeUserId: "j5", positions: [], desertedPositions: [1], eligibleParticipantIds: allEligible }
    ];
    expect(positionOf(computeF2(awardCards, 5), "A")).toBe(1);

    const desertCards: JudgeCard[] = [
      { judgeUserId: "j1", positions: [{ participantId: "A", position: 1 }], desertedPositions: [], eligibleParticipantIds: allEligible },
      { judgeUserId: "j2", positions: [{ participantId: "A", position: 1 }], desertedPositions: [], eligibleParticipantIds: allEligible },
      { judgeUserId: "j3", positions: [], desertedPositions: [1], eligibleParticipantIds: allEligible },
      { judgeUserId: "j4", positions: [], desertedPositions: [1], eligibleParticipantIds: allEligible },
      { judgeUserId: "j5", positions: [], desertedPositions: [1], eligibleParticipantIds: allEligible }
    ];
    const deserted = computeF2(desertCards, 5);
    expect(desertedAt(deserted, 1)?.reason).toBe("EXPLICIT_MAJORITY");
    expect(positionOf(deserted, "A")).toBe(6);
  });
});

describe("computeF2 - mayoría de primeros puestos", () => {
  it("la mayoría de primeros puestos adjudica el 1.º por votos de ese puesto", () => {
    const cards = [
      card("j1", ["A", "B", "C"]),
      card("j2", ["A", "B", "C"]),
      card("j3", ["B", "C", "A"])
    ];
    const result = computeF2(cards, 3);
    expect(result.majorityWinnerId).toBe("A");
    expect(positionOf(result, "A")).toBe(1);
  });

  it("sin mayoría clara en un puesto, el puesto queda desierto", () => {
    const cards = [card("j1", ["A", "B"]), card("j2", ["B", "A"])];
    const result = computeF2(cards, 2);
    expect(result.majorityWinnerId).toBeNull();
    expect(desertedAt(result, 1)?.reason).toBe("INSUFFICIENT_CONSIDERATION");
    expect(desertedAt(result, 2)?.reason).toBe("INSUFFICIENT_CONSIDERATION");
    // Misma suma residual fuera del top 5: empate no bloqueante.
    expect(result.hasTie).toBe(true);
    expect(result.hasBlockingTie).toBe(false);
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
    // C: 6+3+3=12; solo 2 votos en 3.º → no alcanza umbral 2? Wait 2 votes at pos 3 from j2,j3
    expect(sumOf(result, "C")).toBe(12);
    expect(positionOf(result, "C")).toBe(3);
  });

  it("conserva sumas del escenario con 8 ejemplares sin compactar por mérito residual", () => {
    const allEligible = ["p5", "p6", "p3", "p7", "p1", "p8", "p14", "p2"];
    const cards: JudgeCard[] = [
      {
        judgeUserId: "j1",
        positions: [
          { participantId: "p7", position: 1 },
          { participantId: "p8", position: 3 }
        ],
        desertedPositions: [],
        eligibleParticipantIds: allEligible
      },
      {
        judgeUserId: "j2",
        positions: [
          { participantId: "p5", position: 1 },
          { participantId: "p6", position: 2 },
          { participantId: "p3", position: 3 },
          { participantId: "p1", position: 4 },
          { participantId: "p2", position: 5 }
        ],
        desertedPositions: [],
        eligibleParticipantIds: allEligible
      },
      {
        judgeUserId: "j3",
        positions: [
          { participantId: "p5", position: 1 },
          { participantId: "p6", position: 2 },
          { participantId: "p3", position: 3 },
          { participantId: "p14", position: 4 },
          { participantId: "p1", position: 5 }
        ],
        desertedPositions: [],
        eligibleParticipantIds: allEligible
      }
    ];

    const result = computeF2(cards, 3);

    expect(sumOf(result, "p5")).toBe(8);
    expect(sumOf(result, "p6")).toBe(10);
    expect(sumOf(result, "p3")).toBe(12);
    expect(sumOf(result, "p1")).toBe(15);
    expect(positionOf(result, "p5")).toBe(1);
    expect(positionOf(result, "p6")).toBe(2);
    expect(positionOf(result, "p3")).toBe(3);
    // 4.º: p1 y p14 empatan a 1 voto → desierto; 5.º: p2 y p1 a 1 → desierto.
    expect(desertedAt(result, 4)?.reason).toBe("INSUFFICIENT_CONSIDERATION");
    expect(desertedAt(result, 5)?.reason).toBe("INSUFFICIENT_CONSIDERATION");
    
    expect(result.hasBlockingTie).toBe(false);
  });

  it("cardsCount refleja el número real de jueces que asignaron puesto", () => {
    const result = computeF2(
      [card("j1", ["A", "B"], ["C"]), card("j2", ["A", "C", "B"]), card("j3", ["A", "B", "C"])],
      3
    );
    expect(result.participants.find((p) => p.participantId === "A")?.cardsCount).toBe(3);
    expect(result.participants.find((p) => p.participantId === "C")?.cardsCount).toBe(2);
  });
});

describe("computeF2 - desiertos explícitos y 5.e", () => {
  it("Nota 5.b: mayoría explícita de desierto prevalece aunque un juez asigne el puesto", () => {
    const allEligible = ["A", "B", "C", "D", "E"];
    const cards: JudgeCard[] = [
      {
        judgeUserId: "j1",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 },
          { participantId: "C", position: 3 },
          { participantId: "D", position: 4 }
        ],
        desertedPositions: [5],
        eligibleParticipantIds: allEligible
      },
      {
        judgeUserId: "j2",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 },
          { participantId: "C", position: 3 },
          { participantId: "D", position: 4 }
        ],
        desertedPositions: [5],
        eligibleParticipantIds: allEligible
      },
      {
        judgeUserId: "j3",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 },
          { participantId: "C", position: 3 },
          { participantId: "D", position: 4 },
          { participantId: "E", position: 5 }
        ],
        desertedPositions: [],
        eligibleParticipantIds: allEligible
      }
    ];

    const result = computeF2(cards, 3);
    expect(desertedAt(result, 5)).toEqual({
      finalPosition: 5,
      desertedVotes: 2,
      assignedVotes: 1,
      minimumRequired: 2,
      reason: "EXPLICIT_MAJORITY"
    });
    expect(positionOf(result, "E")).toBe(6);
  });

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
    // Quinto: F tiene 2 votos (j2, j3) frente a 1 de E → adjudicado; E queda residual.
    expect(positionOf(result, "F")).toBe(5);
    expect(positionOf(result, "E")).toBe(6);
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
      {
        judgeUserId: "j1",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 },
          { participantId: "C", position: 3 },
          { participantId: "D", position: 4 },
          { participantId: "E", position: 5 }
        ],
        desertedPositions: [],
        eligibleParticipantIds: allEligible
      },
      {
        judgeUserId: "j2",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 },
          { participantId: "E", position: 3 },
          { participantId: "D", position: 4 },
          { participantId: "F", position: 5 }
        ],
        desertedPositions: [],
        eligibleParticipantIds: allEligible
      },
      {
        judgeUserId: "j3",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 },
          { participantId: "E", position: 3 },
          { participantId: "D", position: 4 },
          { participantId: "G", position: 5 }
        ],
        desertedPositions: [],
        eligibleParticipantIds: allEligible
      }
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

  it("puestos sin asignación suficiente se reportan como DESERTED (no UNAWARDED)", () => {
    const result = computeF2(
      [card("j1", ["A", "B", "C"]), card("j2", ["A", "B", "C"]), card("j3", ["A", "B", "C"])],
      3
    );
    
    expect(result.desertedResults.map((row) => row.finalPosition)).toEqual([4, 5]);
  });

  it("consideración insuficiente en un puesto produce DESERTED con reason INSUFFICIENT_CONSIDERATION", () => {
    const cards: JudgeCard[] = [
      {
        judgeUserId: "j1",
        positions: [{ participantId: "X", position: 1 }],
        desertedPositions: [],
        eligibleParticipantIds: ["X"]
      },
      {
        judgeUserId: "j2",
        positions: [],
        desertedPositions: [],
        eligibleParticipantIds: ["X"]
      },
      {
        judgeUserId: "j3",
        positions: [],
        desertedPositions: [],
        eligibleParticipantIds: ["X"]
      }
    ];
    const result = computeF2(cards, 3);
    expect(desertedAt(result, 1)?.reason).toBe("INSUFFICIENT_CONSIDERATION");
    
    expect(positionOf(result, "X")).toBe(6);
  });

  it("con 5 jueces exige 3 votos para desierto explícito y para adjudicación", () => {
    const allEligible = ["A", "B", "C", "D"];
    const cards: JudgeCard[] = [
      { judgeUserId: "j1", positions: [{ participantId: "A", position: 1 }], desertedPositions: [2], eligibleParticipantIds: allEligible },
      { judgeUserId: "j2", positions: [{ participantId: "A", position: 1 }], desertedPositions: [2], eligibleParticipantIds: allEligible },
      { judgeUserId: "j3", positions: [{ participantId: "A", position: 1 }], desertedPositions: [2], eligibleParticipantIds: allEligible },
      { judgeUserId: "j4", positions: [{ participantId: "C", position: 1 }], desertedPositions: [], eligibleParticipantIds: allEligible },
      { judgeUserId: "j5", positions: [{ participantId: "C", position: 1 }], desertedPositions: [], eligibleParticipantIds: allEligible }
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
    expect(desertedAt(result, 3)?.reason).toBe("NO_ASSIGNMENTS");
    expect(positionOf(result, "C")).toBe(6);
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

  it("ejemplares adjudicados por votos no abren empate por suma aunque compartan total", () => {
    const cards = [
      card("j1", ["A", "B", "C"]),
      card("j2", ["A", "B", "C"]),
      card("j3", ["B", "A", "C"])
    ];
    // A: 1+1+2=4, B: 2+2+1=5 — distintos; sin empate.
    const result = computeF2(cards, 3);
    expect(positionOf(result, "A")).toBe(1);
    expect(positionOf(result, "B")).toBe(2);
    expect(result.tiedGroups.filter((g) => g.reason === "SUM_EQUALITY")).toHaveLength(0);
  });
});
