import { describe, expect, it } from "vitest";
import {
  getBlockingTiedBlocks,
  tieBlockKey,
  typedTieBlockKey
} from "@pegasus/core/judging/tie-blocks";

type Row = {
  id: string;
  finalPosition: number | null;
  scoreValue: number | null;
  status: string;
};

function row(id: string, finalPosition: number, scoreValue: number, status = "TIED"): Row {
  return { id, finalPosition, scoreValue, status };
}

describe("getBlockingTiedBlocks", () => {
  it("distingue identidades con los mismos participantes pero distinta causa", () => {
    expect(typedTieBlockKey("SUM_EQUALITY", ["b", "a"])).toBe("SUM_EQUALITY:a|b");
    expect(typedTieBlockKey("FIFTH_PLACE_EXCEPTION_5E", ["a", "b"])).not.toBe(
      typedTieBlockKey("SUM_EQUALITY", ["a", "b"])
    );
  });

  it("agrupa empate por misma suma en puestos premiables", () => {
    const blocks = getBlockingTiedBlocks(
      [row("p3", 2, 7), row("p4", 3, 7)]
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.map((r) => r.id).sort()).toEqual(["p3", "p4"]);
  });

  it("no infiere la excepción 5.e de filas TIED consecutivas con sumas distintas", () => {
    const blocks = getBlockingTiedBlocks(
      [row("p5", 5, 15), row("p6", 6, 16)]
    );

    expect(blocks).toHaveLength(0);
  });

  it("no bloquea empates fuera de premiación", () => {
    const blocks = getBlockingTiedBlocks(
      [row("p6", 6, 12), row("p7", 7, 12)]
    );

    expect(blocks).toHaveLength(0);
  });

  it("incluye el grupo completo cuando la igualdad comienza dentro del top 5", () => {
    const blocks = getBlockingTiedBlocks(
      [row("p14", 3, 13), row("p3", 6, 13), row("p1", 7, 13)]
    );

    expect(blocks).toHaveLength(1);
    expect(tieBlockKey(blocks[0]!.map((r) => r.id))).toBe("p1|p14|p3");
  });

  it("mantiene empate por suma cuando ambos están en puestos premiables", () => {
    const blocks = getBlockingTiedBlocks(
      [row("p14", 3, 13), row("p10", 4, 13)]
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.map((r) => r.id).sort()).toEqual(["p10", "p14"]);
  });
});