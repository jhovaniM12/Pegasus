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

export async function findFairStaffByPersonId(
  dataSource: DataSource,
  personId: string
): Promise<FairStaff[]> {
  return dataSource.getRepository(FairStaff).find({
    where: { personId },
    relations: { fair: true, person: true, role: true },
    order: { createdAt: "ASC" }
  });
}

export async function findFairStaffByPersonIds(
  dataSource: DataSource,
  personIds: string[]
): Promise<FairStaff[]> {
  if (personIds.length === 0) {
    return [];
  }

  return dataSource
    .getRepository(FairStaff)
    .createQueryBuilder("staff")
    .innerJoinAndSelect("staff.role", "role")
    .where("staff.person_id IN (:...personIds)", { personIds })
    .orderBy("staff.created_at", "ASC")
    .getMany();
}
