import type { DataSource } from "typeorm";
import { Category } from "../entities/category.entity.js";
import type { PaginatedResult, PaginationParams } from "./types.js";

export type CategoryGaitSummary = {
  id: string;
  name: string | null;
};

export const CATEGORY_RELATIONS = {
  sex: true,
  gait: true,
  equineType: true,
  grouping: true
} as const;

export async function findCategoriesPaginated(
  dataSource: DataSource,
  params: PaginationParams & { gaitId?: string }
): Promise<PaginatedResult<Category>> {
  const [items, total] = await dataSource.getRepository(Category).findAndCount({
    where: params.gaitId ? { gaitId: params.gaitId } : undefined,
    relations: CATEGORY_RELATIONS,
    order: { name: "ASC" },
    skip: (params.page - 1) * params.limit,
    take: params.limit
  });

  return { items, total, page: params.page, limit: params.limit };
}

export async function findCategoryById(
  dataSource: DataSource,
  id: string
): Promise<Category | null> {
  return dataSource.getRepository(Category).findOne({
    where: { id },
    relations: CATEGORY_RELATIONS
  });
}

export async function findCategoryGaits(dataSource: DataSource): Promise<CategoryGaitSummary[]> {
  const rows = await dataSource
    .getRepository(Category)
    .createQueryBuilder("category")
    .innerJoin("category.gait", "gait")
    .select("gait.id", "id")
    .addSelect("gait.name", "name")
    .distinct(true)
    .orderBy("gait.name", "ASC")
    .getRawMany<CategoryGaitSummary>();

  return rows;
}
