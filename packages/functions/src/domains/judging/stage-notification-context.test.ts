import type { FairCategoryStage } from "@pegasus/core";
import { describe, expect, it } from "vitest";
import { stageNotificationContext } from "./shared.js";

describe("stageNotificationContext", () => {
  it("construye el contexto con las relaciones de la etapa", () => {
    const stage = {
      id: "stage-1",
      category: { name: "Potrancas", gait: { name: "Trocha" } },
      fair: { name: "Feria Nacional" }
    } as FairCategoryStage;

    expect(stageNotificationContext(stage)).toMatchObject({
      categoryName: "Potrancas",
      fairName: "Feria Nacional",
      gaitName: "Trocha",
      detail: "Potrancas - Trocha en Feria Nacional",
      payload: {
        stageId: "stage-1",
        categoryName: "Potrancas",
        fairName: "Feria Nacional",
        gaitName: "Trocha"
      }
    });
  });

  it("no interrumpe el flujo si una etapa fue cargada sin relaciones", () => {
    const stage = { id: "stage-1" } as FairCategoryStage;

    expect(stageNotificationContext(stage)).toMatchObject({
      categoryName: "Categoria sin nombre",
      fairName: "Feria sin nombre",
      gaitName: "Sin andar",
      payload: { stageId: "stage-1" }
    });
  });
});
