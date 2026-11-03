import { describe, expect, it } from "vitest";
import { updateJudgingSystemSettingsSchema } from "./system-settings.schema.js";

describe("updateJudgingSystemSettingsSchema", () => {
  it("acepta un límite entero entre 1 y 50", () => {
    expect(updateJudgingSystemSettingsSchema.parse({ f1MaxSelections: 10 })).toEqual({
      f1MaxSelections: 10
    });
  });

  it.each([0, 51, 2.5])("rechaza el límite inválido %s", (f1MaxSelections) => {
    expect(() => updateJudgingSystemSettingsSchema.parse({ f1MaxSelections })).toThrow();
  });
});
