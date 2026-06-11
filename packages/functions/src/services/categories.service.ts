import {
  findCategoryGaits,
  findCategoriesPaginated,
  findCategoryById,
  getDataSource,
  type CategoryGaitSummary,
  type PaginatedResult,
  type PaginationParams
} from "@pegasus/core";
import type { Category } from "@pegasus/core";
import { NotFoundError } from "../lib/errors.js";

export async function listCategories(
  params: PaginationParams & { gaitId?: string }
): Promise<PaginatedResult<Category>> {
  const dataSource = await getDataSource();
  return findCategoriesPaginated(dataSource, params);
}

export async function listCategoryGaits(): Promise<CategoryGaitSummary[]> {
  const dataSource = await getDataSource();
  return findCategoryGaits(dataSource);
}

export async function getCategoryById(categoryId: string): Promise<Category> {
  const dataSource = await getDataSource();
  const category = await findCategoryById(dataSource, categoryId);

  if (!category) {
    throw new NotFoundError(`No se encontró la categoría con id "${categoryId}".`);
  }

  return category;
}
