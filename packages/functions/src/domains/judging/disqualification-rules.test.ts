import { describe, expect, it } from "vitest";
import {
  HYPERFLEXION_REASON_CODE,
  requiredDisqualificationReports
} from "./disqualification-rules.js";

describe("requiredDisqualificationReports", () => {
  it("requiere un reporte para toda causal distinta de hiperflexión", () => {
    expect(requiredDisqualificationReports("1", 3)).toBe(1);
    expect(requiredDisqualificationReports("17", 5)).toBe(1);
  });

  it("aplica 1/1, 2/3 y 3/5 para hiperflexión", () => {
    expect(requiredDisqualificationReports(HYPERFLEXION_REASON_CODE, 1)).toBe(1);
    expect(requiredDisqualificationReports(HYPERFLEXION_REASON_CODE, 3)).toBe(2);
    expect(requiredDisqualificationReports(HYPERFLEXION_REASON_CODE, 5)).toBe(3);
  });

  it("rechaza paneles simultáneos 2/4 para hiperflexión", () => {
    expect(() => requiredDisqualificationReports(HYPERFLEXION_REASON_CODE, 2)).toThrow(
      "Panel simultáneo no reglamentario"
    );
    expect(() => requiredDisqualificationReports(HYPERFLEXION_REASON_CODE, 4)).toThrow(
      "Panel simultáneo no reglamentario"
    );
  });
});
