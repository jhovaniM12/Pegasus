import { describe, expect, it } from "vitest";
import { computeF2, majorityThreshold, type JudgeCard, type TiedGroup } from "./scoring.js";

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

describe("majorityThreshold", () => {
  it("calcula la mayoría simple según el número de jueces", () => {
    expect(majorityThreshold(1)).toBe(1);
    expect(majorityThreshold(2)).toBe(2);
    expect(majorityThreshold(3)).toBe(2);
    expect(majorityThreshold(5)).toBe(3);
  });
});

describe("computeF2 - suma ordinal", () => {
  it("gana la menor suma de puestos", () => {
    const cards = [
      card("j1", ["A", "B", "C"]),
      card("j2", ["A", "C", "B"]),
      card("j3", ["B", "A", "C"])
    ];
    const result = computeF2(cards, 3);

    // A: 1+1+2 = 4, B: 2+3+1 = 6, C: 3+2+3 = 8
    expect(positionOf(result, "A")).toBe(1);
    expect(positionOf(result, "B")).toBe(2);
    expect(positionOf(result, "C")).toBe(3);
    expect(result.hasTie).toBe(false);
  });

  it("ordena correctamente a todos los participantes por suma", () => {
    const cards = [card("j1", ["A", "B", "C", "D"]), card("j2", ["A", "B", "C", "D"])];
    const result = computeF2(cards, 2);
    expect(result.participants.map((p) => p.participantId)).toEqual(["A", "B", "C", "D"]);
  });
});

describe("computeF2 - mayoría de primeros puestos", () => {
  it("la mayoría de primeros puestos prevalece sobre la suma", () => {
    // A es 1.º en 2 de 3 tarjetas (mayoría) aunque su suma no sea la menor.
    const cards = [
      card("j1", ["A", "B", "C"]), // A=1, B=2, C=3
      card("j2", ["A", "B", "C"]), // A=1, B=2, C=3
      card("j3", ["B", "C", "A"]) // B=1, C=2, A=3
    ];
    const result = computeF2(cards, 3);
    // A: suma 5, B: suma 5 -> empatarían por suma, pero A tiene mayoría de primeros (2/3).
    expect(result.majorityWinnerId).toBe("A");
    expect(positionOf(result, "A")).toBe(1);
    expect(result.hasTie).toBe(false);
  });

  it("sin mayoría clara la regla no se aplica", () => {
    const cards = [card("j1", ["A", "B"]), card("j2", ["B", "A"])];
    const result = computeF2(cards, 2);
    // A: 1+2=3, B: 2+1=3 -> empate, ninguno tiene mayoría (umbral 2, cada uno 1).
    expect(result.majorityWinnerId).toBeNull();
    expect(result.hasTie).toBe(true);
  });
});

describe("computeF2 - empates", () => {
  it("misma suma genera empate y marca el grupo", () => {
    const cards = [
      card("j1", ["A", "B", "C"]),
      card("j2", ["B", "A", "C"]),
      card("j3", ["C", "A", "B"])
    ];
    // A: 1+2+2 = 5, B: 2+1+3 = 6, C: 3+3+1 = 7 -> sin empate
    const noTie = computeF2(cards, 3);
    expect(noTie.hasTie).toBe(false);
    expect(noTie.hasBlockingTie).toBe(false);

    // Forzamos empate real entre A y B.
    const tieCards = [card("j1", ["A", "B"]), card("j2", ["B", "A"])];
    const result = computeF2(tieCards, 2);
    expect(result.hasTie).toBe(true);
    expect(result.tiedGroups).toHaveLength(1);
    expect(result.tiedGroups[0].participantIds.sort()).toEqual(["A", "B"]);
    expect(result.participants.every((p) => p.tied)).toBe(true);
  });

  it("el empate bloquea el cierre pero asigna puestos provisionales contiguos", () => {
    // C gana claramente; A y B empatan por el 2.º/3.º puesto.
    const cards = [
      card("j1", ["C", "A", "B"]),
      card("j2", ["C", "B", "A"])
    ];
    const result = computeF2(cards, 2);
    // C: 1+1=2, A: 2+3=5, B: 3+2=5 -> empate A/B
    expect(positionOf(result, "C")).toBe(1);
    expect(result.hasTie).toBe(true);
    const tiedPositions = result.participants.filter((p) => p.tied).map((p) => p.finalPosition).sort();
    expect(tiedPositions).toEqual([2, 3]);
  });
});

describe("computeF2 - voto de castigo", () => {
  it("aplica penalización a participantes no puntuados por un juez", () => {
    // J1 solo puntúa a A y B; C recibe voto de castigo (6) de J1.
    // J2 puntúa a A, B y C.
    const cards = [
      card("j1", ["A", "B"], ["C"]),      // C → castigo 6 de j1
      card("j2", ["A", "C", "B"])         // todos puntuados
    ];
    const result = computeF2(cards, 2);

    // A: 1+1=2, B: 2+3=5, C: 6+2=8
    expect(positionOf(result, "A")).toBe(1);
    expect(positionOf(result, "B")).toBe(2);
    expect(positionOf(result, "C")).toBe(6);
    expect(sumOf(result, "A")).toBe(2);
    expect(sumOf(result, "B")).toBe(5);
    expect(sumOf(result, "C")).toBe(8);
  });

  it("replica el ejemplo del screenshot: 8 participantes, 3 jueces, top 5 cada uno", () => {
    // Juez 1: solo puntúa #7 y #8 (el resto recibe castigo 6)
    // Juez 2: puntúa #5, #6, #3, #1, #2
    // Juez 3: puntúa #5, #6, #3, #14, #1
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

    // Sumas esperadas (castigo = 6):
    // p5:  6+1+1=8   → 1°
    // p6:  6+2+2=10  → 2°
    // p3:  6+3+3=12  → 3°
    // p7:  1+6+6=13  → no cumple consideración mínima (1/2), se difiere sin cinta
    // p1:  6+4+5=15  → 4° (siguiente elegible tras p7)
    // p8:  3+6+6=15  → 7°
    // p14: 6+6+4=16  → 8°
    // p2:  6+5+6=17  → 9°
    expect(result.participants).toHaveLength(8);
    expect(positionOf(result, "p5")).toBe(1);
    expect(positionOf(result, "p6")).toBe(2);
    expect(positionOf(result, "p3")).toBe(3);
    expect(positionOf(result, "p1")).toBe(4);
    expect(positionOf(result, "p7")).toBe(6);
    expect(positionOf(result, "p14")).toBe(8);
    expect(positionOf(result, "p2")).toBe(5);

    // El 5° no queda desierto: p2 fue tomado en cuenta como 5° por un juez y no hay
    // mayoría declarando desierto el quinto puesto.
    const pos7 = result.participants.find((p) => p.finalPosition === 7)?.participantId;
    expect(pos7).toBe("p8");

    expect(result.desertedResults).toEqual([]);
    // p1 (sum=15) y p8 (sum=15) siguen empatados y el bloque toca el top 5 → bloquea cierre.
    expect(result.hasTie).toBe(true);
    expect(result.hasBlockingTie).toBe(true);
    const tiedGroup = result.tiedGroups[0];
    expect(tiedGroup.participantIds.sort()).toEqual(["p1", "p8"]);
    expect(tiedGroup.startPosition).toBe(4);
    expect(tiedGroup.endPosition).toBe(7);
    expect(tiedGroup.blocksClosure).toBe(true);
  });

  it("aplica la nota del quinto puesto: no lo declara desierto si hay votos reales de quinto sin mayoría desierta", () => {
    // Caso de la captura reportada:
    // J1: #2, #8, #4, #3, #9
    // J2: #1, #3, #2, #4, #6
    // J3: #2, #4, #3, #6 y deja 5° sin asignar.
    const allEligible = ["p1", "p2", "p3", "p4", "p6", "p7", "p8", "p9"];
    const cards: JudgeCard[] = [
      {
        judgeUserId: "j1",
        positions: [
          { participantId: "p2", position: 1 },
          { participantId: "p8", position: 2 },
          { participantId: "p4", position: 3 },
          { participantId: "p3", position: 4 },
          { participantId: "p9", position: 5 }
        ],
        desertedPositions: [],
        eligibleParticipantIds: allEligible
      },
      {
        judgeUserId: "j2",
        positions: [
          { participantId: "p1", position: 1 },
          { participantId: "p3", position: 2 },
          { participantId: "p2", position: 3 },
          { participantId: "p4", position: 4 },
          { participantId: "p6", position: 5 }
        ],
        desertedPositions: [],
        eligibleParticipantIds: allEligible
      },
      {
        judgeUserId: "j3",
        positions: [
          { participantId: "p2", position: 1 },
          { participantId: "p4", position: 2 },
          { participantId: "p3", position: 3 },
          { participantId: "p6", position: 4 }
        ],
        desertedPositions: [5],
        eligibleParticipantIds: allEligible
      }
    ];

    const result = computeF2(cards, 3);

    expect(positionOf(result, "p2")).toBe(1);
    expect(positionOf(result, "p3")).toBe(2);
    expect(positionOf(result, "p4")).toBe(3);
    expect(positionOf(result, "p6")).toBe(4);
    expect(positionOf(result, "p9")).toBe(5);
    expect(result.desertedResults).toEqual([]);
    expect(result.hasBlockingTie).toBe(true);
    expect(result.tiedGroups[0].participantIds.sort()).toEqual(["p3", "p4"]);
  });

  it("con 3 jueces, candidato sin consideración mínima no consume el puesto: se evalúa el siguiente elegible", () => {
    // J1: #2, #6, #3, #4, #5
    // J2: #6, #4, #7, #3
    // J3: #2, #3, #6, #4, #5
    const allEligible = ["p2", "p3", "p4", "p5", "p6", "p7"];
    const cards: JudgeCard[] = [
      {
        judgeUserId: "j1",
        positions: [
          { participantId: "p2", position: 1 },
          { participantId: "p6", position: 2 },
          { participantId: "p3", position: 3 },
          { participantId: "p4", position: 4 },
          { participantId: "p5", position: 5 }
        ],
        desertedPositions: [],
        eligibleParticipantIds: allEligible
      },
      {
        judgeUserId: "j2",
        positions: [
          { participantId: "p6", position: 1 },
          { participantId: "p4", position: 2 },
          { participantId: "p7", position: 3 },
          { participantId: "p3", position: 4 }
        ],
        desertedPositions: [],
        eligibleParticipantIds: allEligible
      },
      {
        judgeUserId: "j3",
        positions: [
          { participantId: "p2", position: 1 },
          { participantId: "p3", position: 2 },
          { participantId: "p6", position: 3 },
          { participantId: "p4", position: 4 },
          { participantId: "p5", position: 5 }
        ],
        desertedPositions: [],
        eligibleParticipantIds: allEligible
      }
    ];

    const result = computeF2(cards, 3);

    // Sumas: p6=6, p2=8 (mayoría de 1° en 2 tarjetas → 1°), p3=9, p4=10, p7=15 (1 juez), p5=16
    expect(positionOf(result, "p2")).toBe(1);
    expect(positionOf(result, "p6")).toBe(2);
    expect(positionOf(result, "p3")).toBe(3);
    expect(positionOf(result, "p4")).toBe(4);
    expect(positionOf(result, "p5")).toBe(5);
    expect(positionOf(result, "p7")).toBe(6);
    expect(result.desertedResults).toHaveLength(0);
    expect(result.participants.find((p) => p.participantId === "p7")?.cardsCount).toBe(1);
    expect(result.participants.find((p) => p.participantId === "p5")?.cardsCount).toBe(2);
  });

  it("todos los participantes aparecen aunque solo un juez los haya puntuado", () => {
    // Cada juez puntúa a uno diferente; los otros dos reciben castigo.
    const allEligible = ["A", "B", "C"];
    const cards: JudgeCard[] = [
      { judgeUserId: "j1", positions: [{ participantId: "A", position: 1 }], desertedPositions: [], eligibleParticipantIds: allEligible },
      { judgeUserId: "j2", positions: [{ participantId: "B", position: 1 }], desertedPositions: [], eligibleParticipantIds: allEligible },
      { judgeUserId: "j3", positions: [{ participantId: "C", position: 1 }], desertedPositions: [], eligibleParticipantIds: allEligible }
    ];
    const result = computeF2(cards, 3);

    // A: 1+6+6=13, B: 6+1+6=13, C: 6+6+1=13
    // Ninguno cumple consideración mínima (2 de 3) para premiación:
    // los tres quedan diferidos y los puestos 1-5 se declaran desiertos por agotamiento.
    expect(result.participants).toHaveLength(3);
    expect(result.hasTie).toBe(true);
    expect(result.hasBlockingTie).toBe(false);
    expect(result.tiedGroups[0].participantIds.sort()).toEqual(["A", "B", "C"]);
    expect(result.tiedGroups[0].startPosition).toBe(6);
    expect(result.tiedGroups[0].blocksClosure).toBe(false);
    expect(result.desertedResults).toEqual([
      { finalPosition: 1, votesCount: 0 },
      { finalPosition: 2, votesCount: 0 },
      { finalPosition: 3, votesCount: 0 },
      { finalPosition: 4, votesCount: 0 },
      { finalPosition: 5, votesCount: 0 }
    ]);
  });

  it("cardsCount refleja el número real de jueces que asignaron puesto (no incluye votos de castigo)", () => {
    const allEligible = ["A", "B", "C"];
    const cards: JudgeCard[] = [
      // j1 puntúa solo A y B; C recibe castigo de j1
      card("j1", ["A", "B"], ["C"]),
      // j2 puntúa a todos
      card("j2", ["A", "C", "B"])
    ];
    const result = computeF2(cards, 2);

    const a = result.participants.find((p) => p.participantId === "A");
    const b = result.participants.find((p) => p.participantId === "B");
    const c = result.participants.find((p) => p.participantId === "C");

    expect(a?.cardsCount).toBe(2); // ambos jueces asignaron puesto a A
    expect(b?.cardsCount).toBe(2); // ambos jueces asignaron puesto a B
    expect(c?.cardsCount).toBe(1); // solo j2 asignó puesto a C (j1 aplicó castigo)
  });
});

describe("computeF2 - casos borde", () => {
  it("sin tarjetas devuelve resultado vacío", () => {
    const result = computeF2([], 3);
    expect(result.participants).toHaveLength(0);
    expect(result.hasTie).toBe(false);
    expect(result.hasBlockingTie).toBe(false);
  });

  it("un solo juez asigna puestos directamente sin empates", () => {
    const result = computeF2([card("j1", ["A", "B", "C"])], 1);
    expect(positionOf(result, "A")).toBe(1);
    expect(positionOf(result, "C")).toBe(3);
    expect(result.hasTie).toBe(false);
    expect(result.hasBlockingTie).toBe(false);
  });

  it("sin desiertos por mayoría ni bloqueos de premiación, los puestos son secuenciales", () => {
    const cards = [
      card("j1", ["A", "B", "C"]),
      card("j2", ["A", "B", "C"]),
      card("j3", ["A", "B", "C"])
    ];
    const result = computeF2(cards, 3);
    expect(result.participants.map((p) => p.finalPosition)).toEqual([1, 2, 3]);
    // Solo hay 3 ejemplares: los puestos 4 y 5 quedan desiertos por agotamiento.
    expect(result.desertedResults).toEqual([
      { finalPosition: 4, votesCount: 0 },
      { finalPosition: 5, votesCount: 0 }
    ]);
  });

  it("si un puesto es declarado desierto por mayoría, queda en desertedResults y se salta en el ranking", () => {
    const cards: JudgeCard[] = [
      {
        judgeUserId: "j1",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 },
          { participantId: "C", position: 3 }
        ],
        desertedPositions: [3],
        eligibleParticipantIds: ["A", "B", "C"]
      },
      {
        judgeUserId: "j2",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 },
          { participantId: "C", position: 3 }
        ],
        desertedPositions: [3],
        eligibleParticipantIds: ["A", "B", "C"]
      },
      {
        judgeUserId: "j3",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 },
          { participantId: "C", position: 3 }
        ],
        desertedPositions: [],
        eligibleParticipantIds: ["A", "B", "C"]
      }
    ];
    const result = computeF2(cards, 3);
    expect(result.desertedResults).toEqual([
      { finalPosition: 3, votesCount: 2 },
      { finalPosition: 5, votesCount: 0 }
    ]);
    expect(positionOf(result, "A")).toBe(1);
    expect(positionOf(result, "B")).toBe(2);
    expect(positionOf(result, "C")).toBe(4);
  });

  it("si un ejemplar no cumple consideración mínima, no puede ocupar puesto premiable", () => {
    const allEligible = ["A", "B", "C"];
    const cards: JudgeCard[] = [
      // A solo fue considerado por un juez.
      { judgeUserId: "j1", positions: [{ participantId: "A", position: 1 }], desertedPositions: [], eligibleParticipantIds: allEligible },
      { judgeUserId: "j2", positions: [{ participantId: "B", position: 1 }], desertedPositions: [], eligibleParticipantIds: allEligible },
      { judgeUserId: "j3", positions: [{ participantId: "C", position: 1 }], desertedPositions: [], eligibleParticipantIds: allEligible }
    ];
    const result = computeF2(cards, 3);
    // Ninguno cumple la consideración mínima (2 de 3) para premiación.
    expect(result.desertedResults).toEqual([
      { finalPosition: 1, votesCount: 0 },
      { finalPosition: 2, votesCount: 0 },
      { finalPosition: 3, votesCount: 0 },
      { finalPosition: 4, votesCount: 0 },
      { finalPosition: 5, votesCount: 0 }
    ]);
    expect(positionOf(result, "A")).toBe(6);
    expect(positionOf(result, "B")).toBe(7);
    expect(positionOf(result, "C")).toBe(8);
  });
});

describe("computeF2 - grupos de empate y bloqueo de cierre", () => {
  it("empate en posiciones 1-2 bloquea cierre (blocksClosure = true)", () => {
    // A y B empatan para el 1° puesto.
    const cards = [card("j1", ["A", "B", "C"]), card("j2", ["B", "A", "C"])];
    // A: 1+2=3, B: 2+1=3, C: 3+3=6
    const result = computeF2(cards, 2);

    expect(result.hasTie).toBe(true);
    expect(result.hasBlockingTie).toBe(true);

    const group = result.tiedGroups.find((g) => g.participantIds.includes("A"));
    expect(group).toBeDefined();
    expect(group!.startPosition).toBe(1);
    expect(group!.endPosition).toBe(2);
    expect(group!.blocksClosure).toBe(true);
  });

  it("empate 5-6 (cruzando quinto puesto) bloquea cierre", () => {
    // Participantes A, B, C, D ganan claramente; E y F empatan para el 5° puesto.
    const allEligible = ["A", "B", "C", "D", "E", "F"];
    const cards: JudgeCard[] = [
      card("j1", ["A", "B", "C", "D", "E", "F"]),
      card("j2", ["A", "B", "C", "D", "F", "E"]) // E y F intercambian 5° y 6°
    ];
    // A: 1+1=2, B: 2+2=4, C: 3+3=6, D: 4+4=8, E: 5+6=11, F: 6+5=11
    const result = computeF2(cards, 2);

    expect(positionOf(result, "A")).toBe(1);
    expect(positionOf(result, "B")).toBe(2);
    expect(positionOf(result, "C")).toBe(3);
    expect(positionOf(result, "D")).toBe(4);
    expect(result.hasTie).toBe(true);
    expect(result.hasBlockingTie).toBe(true);

    const tieGroup = result.tiedGroups.find((g) => g.participantIds.includes("E"));
    expect(tieGroup).toBeDefined();
    // Los puestos 5 y 6 están empatados; startPosition = 5 <= MAX_AWARD_POSITIONS → bloquea
    expect(tieGroup!.startPosition).toBe(5);
    expect(tieGroup!.endPosition).toBe(6);
    expect(tieGroup!.blocksClosure).toBe(true);
  });

  it("empate 6-7 (fuera del top 5) NO bloquea cierre", () => {
    // Los 5 primeros puestos están definidos; solo hay empate en posiciones 6-7+.
    const allEligible = ["A", "B", "C", "D", "E", "F", "G"];
    const cards: JudgeCard[] = [
      card("j1", ["A", "B", "C", "D", "E", "F", "G"]),
      card("j2", ["A", "B", "C", "D", "E", "G", "F"]) // F y G intercambian 6° y 7°
    ];
    // A:1+1=2, B:2+2=4, C:3+3=6, D:4+4=8, E:5+5=10, F:6+7=13, G:7+6=13
    const result = computeF2(cards, 2);

    expect(positionOf(result, "A")).toBe(1);
    expect(positionOf(result, "E")).toBe(5);
    expect(result.hasTie).toBe(true);
    // El empate F-G está en posiciones 6-7 → NO bloquea cierre
    expect(result.hasBlockingTie).toBe(false);

    const tieGroup = result.tiedGroups.find((g) => g.participantIds.includes("F"));
    expect(tieGroup).toBeDefined();
    expect(tieGroup!.startPosition).toBe(6);
    expect(tieGroup!.endPosition).toBe(7);
    expect(tieGroup!.blocksClosure).toBe(false);
  });

  it("dos bloques empatados independientes: solo el bloqueante activa hasBlockingTie", () => {
    // A-B empatan por puesto 2 (bloqueante); F-G empatan por puesto 6-7 (no bloqueante).
    const allEligible = ["W", "A", "B", "C", "D", "F", "G"];
    const cards: JudgeCard[] = [
      card("j1", ["W", "A", "B", "C", "D", "F", "G"]),
      card("j2", ["W", "B", "A", "C", "D", "G", "F"])
    ];
    // W:1+1=2, A:2+3=5, B:3+2=5, C:4+4=8, D:5+5=10, F:6+7=13, G:7+6=13
    const result = computeF2(cards, 2);

    expect(positionOf(result, "W")).toBe(1);
    expect(result.hasTie).toBe(true);
    expect(result.hasBlockingTie).toBe(true);
    expect(result.tiedGroups).toHaveLength(2);

    const blockingGroup = result.tiedGroups.find((g) => g.blocksClosure);
    const nonBlockingGroup = result.tiedGroups.find((g) => !g.blocksClosure);

    expect(blockingGroup).toBeDefined();
    expect(blockingGroup!.participantIds.sort()).toEqual(["A", "B"]);
    expect(blockingGroup!.startPosition).toBe(2);

    expect(nonBlockingGroup).toBeDefined();
    expect(nonBlockingGroup!.participantIds.sort()).toEqual(["F", "G"]);
    expect(nonBlockingGroup!.startPosition).toBe(6);
    expect(nonBlockingGroup!.blocksClosure).toBe(false);
  });

  it("empate único solo entre posiciones 6-7 no genera hasBlockingTie", () => {
    // 5 participantes ganan claramente; dos más empatan fuera del top 5.
    const allEligible = ["A", "B", "C", "D", "E", "F", "G"];
    const cards: JudgeCard[] = [
      card("j1", ["A", "B", "C", "D", "E", "F", "G"]),
      card("j2", ["A", "B", "C", "D", "E", "G", "F"])
    ];
    const result = computeF2(cards, 2);

    expect(result.hasBlockingTie).toBe(false);
    expect(result.hasTie).toBe(true);
    // El empate en 6-7 no es bloqueante → puede cerrarse sin desempate
    const nonBlockingGroup = result.tiedGroups[0];
    expect(nonBlockingGroup.blocksClosure).toBe(false);
  });

  it("con 5 jueces exige 3 votos para desierto y para consideración mínima", () => {
    const allEligible = ["A", "B", "C", "D"];
    const cards: JudgeCard[] = [
      // A es considerado por 3 jueces (j1, j2, j3) y debe poder premiarse.
      // C es considerado por 2 jueces (j4, j5): no cumple umbral 3.
      { judgeUserId: "j1", positions: [{ participantId: "A", position: 1 }], desertedPositions: [2], eligibleParticipantIds: allEligible },
      { judgeUserId: "j2", positions: [{ participantId: "A", position: 1 }], desertedPositions: [2], eligibleParticipantIds: allEligible },
      { judgeUserId: "j3", positions: [{ participantId: "A", position: 1 }], desertedPositions: [2], eligibleParticipantIds: allEligible },
      { judgeUserId: "j4", positions: [{ participantId: "C", position: 1 }], desertedPositions: [], eligibleParticipantIds: allEligible },
      { judgeUserId: "j5", positions: [{ participantId: "C", position: 1 }], desertedPositions: [], eligibleParticipantIds: allEligible }
    ];

    const result = computeF2(cards, 5);

    // 2° desierto explícito por mayoría (3/5).
    // C no cumple consideración mínima (2/5) y se difiere; no quedan elegibles → 3°-5° desiertos.
    expect(result.desertedResults).toEqual([
      { finalPosition: 2, votesCount: 3 },
      { finalPosition: 3, votesCount: 0 },
      { finalPosition: 4, votesCount: 0 },
      { finalPosition: 5, votesCount: 0 }
    ]);
    expect(positionOf(result, "A")).toBe(1);
    expect(positionOf(result, "C")).toBe(6);
  });
});
