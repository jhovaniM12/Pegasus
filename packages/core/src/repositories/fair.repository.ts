import type { DataSource } from "typeorm";
import { Fair } from "../entities/fair.entity.js";
import type { PaginatedResult, PaginationParams } from "./types.js";

const FAIR_RELATIONS = { city: true, grade: true } as const;

export async function findFairsPaginated(
  dataSource: DataSource,
  params: PaginationParams
): Promise<PaginatedResult<Fair>> {
  const [items, total] = await dataSource.getRepository(Fair).findAndCount({
    relations: FAIR_RELATIONS,
    order: { startDate: "DESC", name: "ASC" },
    skip: (params.page - 1) * params.limit,
    take: params.limit
  });

  return { items, total, page: params.page, limit: params.limit };
}

export async function findFairById(dataSource: DataSource, id: string): Promise<Fair | null> {
  return dataSource.getRepository(Fair).findOne({
    where: { id },
    relations: FAIR_RELATIONS
  });
}
