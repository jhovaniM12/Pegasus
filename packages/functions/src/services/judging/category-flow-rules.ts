import type { Category } from "@pegasus/core";
import type { ObjectLiteral, SelectQueryBuilder } from "typeorm";
import { NotFoundError } from "../../lib/errors.js";

export const GROUP_JUDGING_CATEGORY_EXTERNAL_IDS = ["GYCC", "GYPC"] as const;

export function isIndividualJudgingCategory(externalId: string | null | undefined): boolean {
  if (!externalId) return true;
  const normalized = externalId.trim().toUpperCase();
  return !GROUP_JUDGING_CATEGORY_EXTERNAL_IDS.some((excluded) => excluded === normalized);
}

export function assertIndividualJudgingCategory(
  category: Pick<Category, "externalId">
): void {
  if (!isIndividualJudgingCategory(category.externalId)) {
    throw new NotFoundError("La categoría no está disponible en el flujo individual.");
  }
}

export function filterIndividualJudgingCategories<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  categoryAlias = "category"
): SelectQueryBuilder<T> {
  return query.andWhere(
    `(${categoryAlias}.external_id IS NULL OR UPPER(TRIM(${categoryAlias}.external_id)) NOT IN (:...groupCategoryExternalIds))`,
    { groupCategoryExternalIds: [...GROUP_JUDGING_CATEGORY_EXTERNAL_IDS] }
  );
}
