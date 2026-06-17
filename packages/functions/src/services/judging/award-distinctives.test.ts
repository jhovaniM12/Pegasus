import { describe, expect, it } from "vitest";
import { resolveAwardDistinctiveForPosition, type AwardDistinctiveInput } from "./award-distinctives.js";

function distinctive(position: number, overrides: Partial<AwardDistinctiveInput> = {}): AwardDistinctiveInput {
  return {
    position,
    label: `Puesto ${position}`,
    colorName: `Color ${position}`,
    colorHex: null,
    isActive: true,
    ...overrides
  };
}

describe("resolveAwardDistinctiveForPosition", () => {
  it("resuelve distintivo para puesto desierto premiable (ej. 3)", () => {
    const distinctives = new Map<number, AwardDistinctiveInput>([
      [3, distinctive(3, { label: "Tercer puesto", colorName: "Bronce", colorHex: "#CD7F32" })]
    ]);

    expect(resolveAwardDistinctiveForPosition(distinctives, 3)).toEqual({
      position: 3,
      label: "Tercer puesto",
      colorName: "Bronce",
      colorHex: "#CD7F32"
    });
  });

  it("no entrega distintivo para posiciones de cómputo 6 o 7", () => {
    const distinctives = new Map<number, AwardDistinctiveInput>([
      [1, distinctive(1)],
      [2, distinctive(2)],
      [3, distinctive(3)],
      [4, distinctive(4)],
      [5, distinctive(5)]
    ]);

    expect(resolveAwardDistinctiveForPosition(distinctives, 6)).toBeNull();
    expect(resolveAwardDistinctiveForPosition(distinctives, 7)).toBeNull();
  });

  it("solo considera máximo cinco cintas premiables", () => {
    const distinctives = new Map<number, AwardDistinctiveInput>([
      [5, distinctive(5, { label: "Quinto puesto" })],
      [6, distinctive(6, { label: "No válido" })]
    ]);

    expect(resolveAwardDistinctiveForPosition(distinctives, 5)?.label).toBe("Quinto puesto");
    expect(resolveAwardDistinctiveForPosition(distinctives, 6)).toBeNull();
  });
});
