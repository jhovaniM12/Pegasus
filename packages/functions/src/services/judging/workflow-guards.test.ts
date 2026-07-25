import { describe, expect, it } from "vitest";
import {
  activeJudgeIndexes,
  assertTieBreakTestsAllowed,
  tieBlockResolutionPriority,
  validateTieBreakOpening
} from "./workflow-guards.js";

describe("activeJudgeIndexes", () => {
  it("permite paneles simultáneos de 1, 3 y 5", () => {
    expect(activeJudgeIndexes({ configuredJudgeCount: 1, isGradeB: false, stageOrdinal: 0 })).toEqual([0]);
    expect(activeJudgeIndexes({ configuredJudgeCount: 3, isGradeB: false, stageOrdinal: 0 })).toEqual([0, 1, 2]);
    expect(activeJudgeIndexes({ configuredJudgeCount: 5, isGradeB: false, stageOrdinal: 0 })).toEqual([0, 1, 2, 3, 4]);
  });

  it("alterna dos jueces en Grado B sin consolidarlos juntos", () => {
    expect(activeJudgeIndexes({ configuredJudgeCount: 2, isGradeB: true, stageOrdinal: 0 })).toEqual([0]);
    expect(activeJudgeIndexes({ configuredJudgeCount: 2, isGradeB: true, stageOrdinal: 1 })).toEqual([1]);
    expect(activeJudgeIndexes({ configuredJudgeCount: 2, isGradeB: true, stageOrdinal: 2 })).toEqual([0]);
  });

  it("prohíbe dos fuera de Grado B y cualquier panel de cuatro", () => {
    expect(() =>
      activeJudgeIndexes({ configuredJudgeCount: 2, isGradeB: false, stageOrdinal: 0 })
    ).toThrow("Dos jueces solo");
    expect(() =>
      activeJudgeIndexes({ configuredJudgeCount: 4, isGradeB: true, stageOrdinal: 0 })
    ).toThrow("Panel simultáneo no reglamentario");
  });
});

describe("tieBlockResolutionPriority", () => {
  it("resuelve SUM 1.º–4.º antes de 5.e sin mezclar causas", () => {
    expect(tieBlockResolutionPriority({ reason: "SUM_EQUALITY", startPosition: 4 })).toBe(0);
    expect(
      tieBlockResolutionPriority({
        reason: "FIFTH_PLACE_EXCEPTION_5E",
        startPosition: 5
      })
    ).toBe(1);
    expect(tieBlockResolutionPriority({ reason: "SUM_EQUALITY", startPosition: 5 })).toBe(2);
  });
});

describe("assertTieBreakTestsAllowed (Art. 13)", () => {
  it("permite Paralelo/Cambio de dirección con 2 ejemplares", () => {
    expect(assertTieBreakTestsAllowed(2, ["PARALLEL"]).ok).toBe(true);
    expect(assertTieBreakTestsAllowed(2, ["DIRECTION_CHANGE"]).ok).toBe(true);
  });

  it("rechaza Paralelo y Cambio de dirección con 3 o más", () => {
    expect(assertTieBreakTestsAllowed(3, ["PARALLEL"]).ok).toBe(false);
    expect(assertTieBreakTestsAllowed(4, ["DIRECTION_CHANGE"]).ok).toBe(false);
    expect(assertTieBreakTestsAllowed(3, ["DOUBLE_TABLE"]).ok).toBe(true);
    expect(assertTieBreakTestsAllowed(3, ["CIRCLES", "MOUNT"]).ok).toBe(true);
  });
});

describe("validateTieBreakOpening", () => {
  it("abre la ronda con solo elegir una prueba permitida", () => {
    expect(
      validateTieBreakOpening({
        testType: "DOUBLE_TABLE",
        completedTestTypes: [],
        tiedParticipantCount: 2
      })
    ).toEqual({ ok: true });
  });

  it("respeta las restricciones de Art. 13 por número de ejemplares", () => {
    expect(
      validateTieBreakOpening({
        testType: "PARALLEL",
        completedTestTypes: [],
        tiedParticipantCount: 3
      }).ok
    ).toBe(false);
  });

  it("impide Montar hasta agotar pruebas anteriores", () => {
    expect(
      validateTieBreakOpening({
        testType: "MOUNT",
        completedTestTypes: ["DOUBLE_TABLE"],
        tiedParticipantCount: 2
      }).ok
    ).toBe(false);
    expect(
      validateTieBreakOpening({
        testType: "MOUNT",
        completedTestTypes: [
          "DOUBLE_TABLE",
          "DIRECTION_CHANGE",
          "PARALLEL",
          "CIRCLES",
          "STOP_AND_GO"
        ],
        tiedParticipantCount: 2
      })
    ).toEqual({ ok: true });
  });
});
