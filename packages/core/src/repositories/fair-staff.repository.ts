import type { DataSource } from "typeorm";
import { FairStaff } from "../entities/fair-staff.js";
import type { PaginatedResult, PaginationParams } from "./types.js";

const FAIR_STAFF_RELATIONS = {
  person: true,
  role: true
} as const;

export async function findFairStaffByFairId(
  dataSource: DataSource,
  fairId: string,
  params: PaginationParams
): Promise<PaginatedResult<FairStaff>> {
  const [items, total] = await dataSource.getRepository(FairStaff).findAndCount({
    where: { fairId },
    relations: FAIR_STAFF_RELATIONS,
    order: { createdAt: "ASC" },
    skip: (params.page - 1) * params.limit,
    take: params.limit
  });

  return { items, total, page: params.page, limit: params.limit };
}
