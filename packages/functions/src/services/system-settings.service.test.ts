import { describe, expect, it } from "vitest";
import {
  DEFAULT_F1_MAX_SELECTIONS,
  MAX_F1_MAX_SELECTIONS,
  MIN_F1_MAX_SELECTIONS,
  normalizeF1MaxSelections
} from "./system-settings.service.js";

describe("normalizeF1MaxSelections", () => {
  it("conserva un límite entero válido", () => {
    expect(normalizeF1MaxSelections(7)).toBe(7);
    expect(normalizeF1MaxSelections(MIN_F1_MAX_SELECTIONS)).toBe(MIN_F1_MAX_SELECTIONS);
    expect(normalizeF1MaxSelections(MAX_F1_MAX_SELECTIONS)).toBe(MAX_F1_MAX_SELECTIONS);
  });

  it("usa 10 como valor seguro si el parámetro no existe o es inválido", () => {
    expect(normalizeF1MaxSelections(undefined)).toBe(DEFAULT_F1_MAX_SELECTIONS);
    expect(normalizeF1MaxSelections(null)).toBe(DEFAULT_F1_MAX_SELECTIONS);
    expect(normalizeF1MaxSelections(0)).toBe(DEFAULT_F1_MAX_SELECTIONS);
    expect(normalizeF1MaxSelections(3.5)).toBe(DEFAULT_F1_MAX_SELECTIONS);
    expect(normalizeF1MaxSelections(MAX_F1_MAX_SELECTIONS + 1)).toBe(
      DEFAULT_F1_MAX_SELECTIONS
    );
  });
});
