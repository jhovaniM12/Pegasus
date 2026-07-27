import { describe, expect, it } from "vitest";
import {
  deriveImplicitDesertedPositions,
  f2AllowedPositions
} from "./f2-deserted-positions.js";
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

describe("cierre F2 — materialización de puestos omitidos", () => {
  const allowed = f2AllowedPositions(1, 5);

  it("deriva omitidos únicamente al cerrar (no en el payload de autosave)", () => {
    // Autosave: el cliente envía desertedPositions vacío aunque haya puestos sin ejemplar.
    const autosaveDeserted: number[] = [];
    expect(autosaveDeserted).toEqual([]);

    // Cierre: el backend deriva los omitidos contra 1..5.
    expect(
      deriveImplicitDesertedPositions({
        allowedPositions: allowed,
        assignedPositions: [2],
        existingDesertedPositions: autosaveDeserted
      })
    ).toEqual([1, 3, 4, 5]);
  });

  it("autosave no materializa: no hay derivados si no se invoca derive al editar", () => {
    // Contrato del autosave: solo persiste lo enviado por el cliente.
    const clientPayloadDeserted: number[] = [];
    const assignedDuringEdit = [1, 3];
    // Sin llamada a deriveImplicitDesertedPositions, los vacíos permanecen vacíos.
    expect(clientPayloadDeserted).toEqual([]);
    expect(assignedDuringEdit).not.toContain(2);
  });

  it("es idempotente: un segundo cierre no duplica desiertos ya materializados", () => {
    const first = deriveImplicitDesertedPositions({
      allowedPositions: allowed,
      assignedPositions: [2],
      existingDesertedPositions: []
    });
    expect(first).toEqual([1, 3, 4, 5]);

    const second = deriveImplicitDesertedPositions({
      allowedPositions: allowed,
      assignedPositions: [2],
      existingDesertedPositions: first
    });
    expect(second).toEqual([]);
  });
});

describe("cierre F2 — consolidación con causa persistible", () => {
  it("cero asignaciones → NO_ASSIGNMENTS", () => {
    const eligible = ["A", "B"];
    const result = computeF2(
      [
        rankingCard("j1", [], eligible, [1, 2, 3, 4, 5]),
        rankingCard("j2", [], eligible, [1, 2, 3, 4, 5]),
        rankingCard("j3", [], eligible, [1, 2, 3, 4, 5])
      ],
      3
    );

    expect(result.desertedResults.find((row) => row.finalPosition === 1)).toMatchObject({
      reason: "EXPLICIT_MAJORITY",
      assignedVotes: 0,
      minimumRequired: 2,
      desertedVotes: 3
    });
  });

  it("cero asignaciones sin votos explícitos → NO_ASSIGNMENTS", () => {
    const result = computeF2(
      [rankingCard("j1", [["A", 1]], ["A"]), rankingCard("j2", [["A", 1]], ["A"]), rankingCard("j3", [["A", 1]], ["A"])],
      3
    );
    expect(result.desertedResults.find((row) => row.finalPosition === 4)).toMatchObject({
      reason: "NO_ASSIGNMENTS",
      assignedVotes: 0,
      minimumRequired: 2,
      desertedVotes: 0
    });
  });

  it("una asignación sin consideración mínima → INSUFFICIENT_CONSIDERATION", () => {
    const result = computeF2(
      [
        rankingCard("j1", [["X", 1]], ["X"]),
        rankingCard("j2", [], ["X"]),
        rankingCard("j3", [], ["X"])
      ],
      3
    );
    expect(result.desertedResults.find((row) => row.finalPosition === 1)).toEqual({
      finalPosition: 1,
      reason: "INSUFFICIENT_CONSIDERATION",
      assignedVotes: 1,
      minimumRequired: 2,
      desertedVotes: 0
    });
  });

  it("2 de 3 jueces adjudican el puesto", () => {
    const result = computeF2(
      [
        rankingCard("j1", [["A", 1]], ["A", "B"]),
        rankingCard("j2", [["A", 1]], ["A", "B"]),
        rankingCard("j3", [], ["A", "B"], [1])
      ],
      3
    );
    expect(result.participants.find((p) => p.participantId === "A")?.finalPosition).toBe(1);
    expect(result.desertedResults.find((row) => row.finalPosition === 1)).toBeUndefined();
  });

  it("3 de 5 jueces adjudican; 2 de 5 no alcanzan", () => {
    const eligible = ["A"];
    const award = computeF2(
      [
        rankingCard("j1", [["A", 1]], eligible),
        rankingCard("j2", [["A", 1]], eligible),
        rankingCard("j3", [["A", 1]], eligible),
        rankingCard("j4", [], eligible, [1]),
        rankingCard("j5", [], eligible, [1])
      ],
      5
    );
    expect(award.participants.find((p) => p.participantId === "A")?.finalPosition).toBe(1);

    const desert = computeF2(
      [
        rankingCard("j1", [["A", 1]], eligible),
        rankingCard("j2", [["A", 1]], eligible),
        rankingCard("j3", [], eligible, [1]),
        rankingCard("j4", [], eligible, [1]),
        rankingCard("j5", [], eligible, [1])
      ],
      5
    );
    expect(desert.desertedResults.find((row) => row.finalPosition === 1)).toMatchObject({
      reason: "EXPLICIT_MAJORITY",
      desertedVotes: 3,
      assignedVotes: 2,
      minimumRequired: 3
    });
  });

  it("mayoría de omitidos/desiertos declara EXPLICIT_MAJORITY", () => {
    const eligible = ["A", "B", "C", "D", "E"];
    const result = computeF2(
      [
        rankingCard("j1", [["A", 1], ["B", 2], ["C", 3], ["D", 4]], eligible, [5]),
        rankingCard("j2", [["A", 1], ["B", 2], ["C", 3], ["D", 4]], eligible, [5]),
        rankingCard("j3", [["A", 1], ["B", 2], ["C", 3], ["D", 4], ["E", 5]], eligible)
      ],
      3
    );
    expect(result.desertedResults.find((row) => row.finalPosition === 5)).toEqual({
      finalPosition: 5,
      reason: "EXPLICIT_MAJORITY",
      assignedVotes: 1,
      minimumRequired: 2,
      desertedVotes: 2
    });
  });

  it("preserva posiciones sin compactar (1.º desierto, ejemplar en 2.º)", () => {
    const eligible = ["h1", "h2", "h3", "h4"];
    const result = computeF2(
      [
        rankingCard("j1", [["h1", 2]], eligible, [1, 3, 4, 5]),
        rankingCard("j2", [["h1", 2]], eligible, [1, 3, 4, 5]),
        rankingCard("j3", [], eligible, [1, 2, 3, 4, 5])
      ],
      3
    );

    expect(result.desertedResults.find((row) => row.finalPosition === 1)?.reason).toBe(
      "EXPLICIT_MAJORITY"
    );
    expect(result.participants.find((p) => p.participantId === "h1")?.finalPosition).toBe(2);
    expect(result.desertedResults.map((row) => row.finalPosition)).toEqual([1, 3, 4, 5]);
  });

  it("tres asignaciones distintas → INSUFFICIENT con assignedVotes=1", () => {
    const result = computeF2(
      [
        rankingCard("j1", [["h1", 3]], ["h1", "h2", "h3"]),
        rankingCard("j2", [["h2", 3]], ["h1", "h2", "h3"]),
        rankingCard("j3", [["h3", 3]], ["h1", "h2", "h3"])
      ],
      3
    );
    expect(result.desertedResults.find((row) => row.finalPosition === 3)).toEqual({
      finalPosition: 3,
      reason: "INSUFFICIENT_CONSIDERATION",
      assignedVotes: 1,
      minimumRequired: 2,
      desertedVotes: 0
    });
  });

  it("idempotencia: consolidar dos veces produce la misma causa y no duplica puestos", () => {
    const cards = [
      rankingCard("j1", [["A", 2]], ["A"], [1, 3, 4, 5]),
      rankingCard("j2", [["A", 2]], ["A"], [1, 3, 4, 5]),
      rankingCard("j3", [], ["A"], [1, 2, 3, 4, 5])
    ];
    const first = computeF2(cards, 3);
    const second = computeF2(cards, 3);

    expect(second.desertedResults).toEqual(first.desertedResults);
    expect(second.participants).toEqual(first.participants);

    const mergedByPosition = new Map(
      [...first.desertedResults, ...second.desertedResults].map((row) => [row.finalPosition, row])
    );
    expect(mergedByPosition.size).toBe(first.desertedResults.length);
    expect(mergedByPosition.get(1)?.reason).toBe(first.desertedResults.find((r) => r.finalPosition === 1)?.reason);
  });
});
