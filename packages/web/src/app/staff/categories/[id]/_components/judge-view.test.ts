import { describe, expect, it } from "vitest";
import { isJudgeViewStale } from "./judge-view";

describe("isJudgeViewStale", () => {
  it("mantiene F1 mientras espera o cursa P1", () => {
    expect(isJudgeViewStale("F1", "F1_IN_PROGRESS")).toBe(false);
    expect(isJudgeViewStale("F1", "F1_CONSOLIDATED")).toBe(false);
  });

  it("marca F1 obsoleta cuando el DT abre P2 o un desempate", () => {
    expect(isJudgeViewStale("F1", "F2_IN_PROGRESS")).toBe(true);
    expect(isJudgeViewStale("F1", "TIE_BREAK_IN_PROGRESS")).toBe(true);
  });

  it("mantiene F2 durante la fase activa y la marca obsoleta al abrir desempate", () => {
    expect(isJudgeViewStale("F2", "F2_IN_PROGRESS")).toBe(false);
    expect(isJudgeViewStale("F2", "TIE_BREAK_IN_PROGRESS")).toBe(true);
  });

  it("permite consulta histórica en categorías cerradas o desiertas", () => {
    expect(isJudgeViewStale("F1", "JUDGING_CLOSED")).toBe(false);
    expect(isJudgeViewStale("F1", "JUDGING_DESERTED")).toBe(false);
    expect(isJudgeViewStale("FA", "JUDGING_CLOSED")).toBe(false);
  });

  it("marca FA obsoleta cuando arranca P1 o P2", () => {
    expect(isJudgeViewStale("FA", "F1_IN_PROGRESS")).toBe(true);
    expect(isJudgeViewStale("FA", "F2_IN_PROGRESS")).toBe(true);
  });
});
