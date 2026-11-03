import { describe, expect, it } from "vitest";
import { deriveTieBreakResidual, type TieBreakResidualResult } from "./tie-break-residual.js";

function result(
  participantId: string,
  scoreValue: number,
  finalPosition: number,
  status: TieBreakResidualResult["status"]
): TieBreakResidualResult {
  return { participantId, scoreValue, firstPlaceVotes: 0, finalPosition, status };
}

describe("deriveTieBreakResidual", () => {
  it("resuelve el primero y conserva únicamente el empate residual", () => {
    const residual = deriveTieBreakResidual({
      startPosition: 2,
      endPosition: 4,
      results: [
        result("6", 7, 2, "PROVISIONAL"),
        result("3", 10, 3, "TIED"),
        result("7", 10, 4, "TIED")
      ]
    });

    expect(residual.resolvedEntries.map((row) => [row.participantId, row.finalPosition])).toEqual([
      ["6", 2]
    ]);
    expect(residual.availablePositions).toEqual([3, 4]);
    expect(residual.remainingTiedGroups).toEqual([
      {
        reason: "SUM_EQUALITY",
        participantIds: ["3", "7"],
        positionSum: 10,
        startPosition: 3,
        endPosition: 4
      }
    ]);
  });

  it("no genera otra ronda cuando todo el bloque quedó ordenado", () => {
    const residual = deriveTieBreakResidual({
      startPosition: 2,
      endPosition: 4,
      results: [
        result("6", 7, 2, "PROVISIONAL"),
        result("3", 9, 3, "PROVISIONAL"),
        result("7", 11, 4, "PROVISIONAL")
      ]
    });

    expect(residual.resolvedEntries).toHaveLength(3);
    expect(residual.availablePositions).toEqual([]);
    expect(residual.remainingTiedGroups).toEqual([]);
  });

  it("mantiene participantes y rango cuando persiste el empate completo", () => {
    const residual = deriveTieBreakResidual({
      startPosition: 2,
      endPosition: 4,
      results: [
        result("3", 9, 2, "TIED"),
        result("6", 9, 3, "TIED"),
        result("7", 9, 4, "TIED")
      ]
    });

    expect(residual.resolvedEntries).toEqual([]);
    expect(residual.availablePositions).toEqual([2, 3, 4]);
    expect(residual.remainingTiedGroups[0]).toMatchObject({
      participantIds: ["3", "6", "7"],
      startPosition: 2,
      endPosition: 4
    });
  });

  it("separa dos igualdades contiguas de sumas diferentes", () => {
    const residual = deriveTieBreakResidual({
      startPosition: 1,
      endPosition: 5,
      results: [
        result("a", 5, 1, "TIED"),
        result("b", 5, 2, "TIED"),
        result("c", 8, 3, "PROVISIONAL"),
        result("d", 11, 4, "TIED"),
        result("e", 11, 5, "TIED")
      ]
    });

    expect(residual.availablePositions).toEqual([1, 2, 4, 5]);
    expect(residual.remainingTiedGroups.map((group) => group.participantIds)).toEqual([
      ["a", "b"],
      ["d", "e"]
    ]);
    expect(residual.remainingTiedGroups.map((group) => [group.startPosition, group.endPosition])).toEqual([
      [1, 2],
      [4, 5]
    ]);
  });

  it("no mezcla una igualdad cuyos puestos no son contiguos", () => {
    const residual = deriveTieBreakResidual({
      startPosition: 1,
      endPosition: 3,
      results: [
        result("a", 5, 1, "TIED"),
        result("x", 7, 2, "PROVISIONAL"),
        result("b", 5, 3, "TIED")
      ]
    });

    expect(residual.remainingTiedGroups).toEqual([]);
  });

  it("es idempotente al reprocesar el mismo consolidado", () => {
    const input = {
      startPosition: 2,
      endPosition: 4,
      results: [
        result("6", 7, 2, "FINAL"),
        result("3", 10, 3, "TIED"),
        result("7", 10, 4, "TIED")
      ]
    };

    expect(deriveTieBreakResidual(input)).toEqual(deriveTieBreakResidual(input));
    expect(
      deriveTieBreakResidual(input).remainingTiedGroups[0]?.participantIds
    ).not.toContain("6");
  });
});
