import type { DataSource } from "typeorm";
import { FairResult } from "../entities/fair-results.js";
import { CATEGORY_RELATIONS } from "./category.repository.js";
import type { PaginatedResult, PaginationParams } from "./types.js";

type FairResultSearchParams = PaginationParams & {
  categoryId?: string;
};

const FAIR_RESULT_RELATIONS = {
  fairEntry: true,
  grade: true,
  category: CATEGORY_RELATIONS,
  title: true
} as const;

export async function findFairResultsByFairId(
  dataSource: DataSource,
  fairId: string,
  params: FairResultSearchParams
): Promise<PaginatedResult<FairResult>> {
  const where = params.categoryId ? { fairId, categoryId: params.categoryId } : { fairId };
  const [items, total] = await dataSource.getRepository(FairResult).findAndCount({
    where,
    relations: FAIR_RESULT_RELATIONS,
    order: { positionObtained: "ASC" },
    skip: (params.page - 1) * params.limit,
    take: params.limit
  });

  return { items, total, page: params.page, limit: params.limit };
}
