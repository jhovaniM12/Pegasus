import { describe, expect, it } from "vitest";
import { getBlockingTiedBlocks, tieBlockKey } from "@pegasus/core/judging/tie-blocks";

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
  it("agrupa empate por misma suma en puestos premiables", () => {
    const blocks = getBlockingTiedBlocks(
      [row("p3", 2, 7), row("p4", 3, 7)],
      (r) => r.id
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.map((r) => r.id).sort()).toEqual(["p3", "p4"]);
  });

  it("detecta empate especial de quinto con sumas distintas (nota 5.e)", () => {
    const blocks = getBlockingTiedBlocks(
      [row("p5", 5, 15), row("p6", 6, 16)],
      (r) => r.id
    );

    expect(blocks).toHaveLength(1);
    expect(tieBlockKey(blocks[0]!.map((r) => r.id))).toBe("p5|p6");
  });

  it("no bloquea empates fuera de premiación", () => {
    const blocks = getBlockingTiedBlocks(
      [row("p6", 6, 12), row("p7", 7, 12)],
      (r) => r.id
    );

    expect(blocks).toHaveLength(0);
  });
});
