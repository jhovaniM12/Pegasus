import { FairCategoryStage } from "@pegasus/core";
import type { EntityManager, SelectQueryBuilder } from "typeorm";
import { describe, expect, it, vi } from "vitest";
import {
  assertIndividualJudgingCategory,
  filterIndividualJudgingCategories,
  isIndividualJudgingCategory
} from "./category-flow-rules.js";
import { getStageOrThrow } from "./shared.js";

describe("reglas de categorías individuales", () => {
  it.each(["GYCC", "GYPC", " gycc ", "gypc"])("excluye %s del flujo individual", (externalId) => {
    expect(isIndividualJudgingCategory(externalId)).toBe(false);
    expect(() => assertIndividualJudgingCategory({ externalId })).toThrow(
      "no está disponible en el flujo individual"
    );
  });

  it("mantiene categorías individuales y códigos administrativos sin clasificar", () => {
    expect(isIndividualJudgingCategory("42")).toBe(true);
    expect(isIndividualJudgingCategory(null)).toBe(true);
  });

  it("aplica exclusión GYCC/GYPC directamente a consultas SQL", () => {
    const query = {
      andWhere: vi.fn().mockReturnThis()
    } as unknown as SelectQueryBuilder<FairCategoryStage>;

    expect(filterIndividualJudgingCategories(query)).toBe(query);
    expect(query.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("category.external_id"),
      { groupCategoryExternalIds: ["GYCC", "GYPC"] }
    );
  });

  it("rechaza acceso directo a una etapa grupal existente", async () => {
    const findOne = vi.fn(async () => ({
      id: "stage-id",
      category: { externalId: "GYPC", gait: {} },
      fair: {}
    }));
    const manager = {
      getRepository: vi.fn((entity: unknown) => {
        expect(entity).toBe(FairCategoryStage);
        return { findOne };
      })
    } as unknown as EntityManager;

    await expect(getStageOrThrow(manager, "stage-id")).rejects.toThrow(
      "no está disponible en el flujo individual"
    );
    expect(findOne).toHaveBeenCalledWith({
      where: { id: "stage-id" },
      relations: { fair: true, category: { gait: true } }
    });
  });
});
