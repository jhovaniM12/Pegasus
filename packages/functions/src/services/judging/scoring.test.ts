import { describe, expect, it } from "vitest";
import { computeF2, majorityThreshold, type JudgeCard } from "./scoring.js";

/** Construye una tarjeta de juez a partir de un orden de participantes (1.º, 2.º, ...). */
function card(judgeUserId: string, orderedParticipantIds: string[]): JudgeCard {
  return {
    judgeUserId,
    positions: orderedParticipantIds.map((participantId, index) => ({
      participantId,
      position: index + 1
    })),
    desertedPositions: []
  };
}

function positionOf(result: ReturnType<typeof computeF2>, participantId: string): number | undefined {
  return result.participants.find((p) => p.participantId === participantId)?.finalPosition;
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
      card("j3", ["C", "A", "B"]) // sumas: A=1+2+2=5? recalcular
    ];
    // A: 1+2+2 = 5, B: 2+1+3 = 6, C: 3+3+1 = 7 -> sin empate
    const noTie = computeF2(cards, 3);
    expect(noTie.hasTie).toBe(false);

    // Forzamos empate real entre A y B.
    const tieCards = [card("j1", ["A", "B"]), card("j2", ["B", "A"])];
    const result = computeF2(tieCards, 2);
    expect(result.hasTie).toBe(true);
    expect(result.tiedGroups).toHaveLength(1);
    expect(result.tiedGroups[0].sort()).toEqual(["A", "B"]);
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

describe("computeF2 - casos borde", () => {
  it("sin tarjetas devuelve resultado vacío", () => {
    const result = computeF2([], 3);
    expect(result.participants).toHaveLength(0);
    expect(result.hasTie).toBe(false);
  });

  it("un solo juez asigna puestos directamente sin empates", () => {
    const result = computeF2([card("j1", ["A", "B", "C"])], 1);
    expect(positionOf(result, "A")).toBe(1);
    expect(positionOf(result, "C")).toBe(3);
    expect(result.hasTie).toBe(false);
  });

  it("marca un puesto desierto cuando alcanza mayoría reglamentaria", () => {
    const cards: JudgeCard[] = [
      { judgeUserId: "j1", positions: [{ participantId: "A", position: 1 }], desertedPositions: [2] },
      { judgeUserId: "j2", positions: [{ participantId: "A", position: 1 }], desertedPositions: [2] },
      { judgeUserId: "j3", positions: [{ participantId: "A", position: 1 }], desertedPositions: [] }
    ];
    const result = computeF2(cards, 3);

    expect(result.desertedResults).toEqual([{ finalPosition: 2, votesCount: 2 }]);
  });

  it("salta el puesto desierto oficial al numerar los ejemplares premiados", () => {
    const cards: JudgeCard[] = [
      {
        judgeUserId: "j1",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 },
          { participantId: "C", position: 4 }
        ],
        desertedPositions: [3]
      },
      {
        judgeUserId: "j2",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 },
          { participantId: "C", position: 4 }
        ],
        desertedPositions: [3]
      },
      {
        judgeUserId: "j3",
        positions: [
          { participantId: "A", position: 1 },
          { participantId: "B", position: 2 },
          { participantId: "C", position: 4 }
        ],
        desertedPositions: []
      }
    ];

    const result = computeF2(cards, 3);

    expect(result.desertedResults).toEqual([{ finalPosition: 3, votesCount: 2 }]);
    expect(positionOf(result, "A")).toBe(1);
    expect(positionOf(result, "B")).toBe(2);
    expect(positionOf(result, "C")).toBe(4);
  });

  it("no premia ejemplares sin mayoría mínima de consideración", () => {
    const cards: JudgeCard[] = [
      { judgeUserId: "j1", positions: [{ participantId: "A", position: 1 }], desertedPositions: [2, 3] },
      { judgeUserId: "j2", positions: [{ participantId: "B", position: 1 }], desertedPositions: [2, 3] },
      { judgeUserId: "j3", positions: [{ participantId: "C", position: 1 }], desertedPositions: [2, 3] }
    ];
    const result = computeF2(cards, 3);

    expect(result.participants).toHaveLength(0);
    expect(result.desertedResults).toEqual([
      { finalPosition: 2, votesCount: 3 },
      { finalPosition: 3, votesCount: 3 }
    ]);
  });

  it("ignora puestos desiertos fuera del rango premiable 1..5", () => {
    const cards: JudgeCard[] = [
      { judgeUserId: "j1", positions: [{ participantId: "A", position: 1 }], desertedPositions: [6, 7] },
      { judgeUserId: "j2", positions: [{ participantId: "A", position: 1 }], desertedPositions: [6] },
      { judgeUserId: "j3", positions: [{ participantId: "A", position: 1 }], desertedPositions: [7] }
    ];
    const result = computeF2(cards, 3);
    expect(result.desertedResults).toEqual([]);
  });
});
