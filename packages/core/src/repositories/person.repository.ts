import type { DataSource } from "typeorm";
import { Person } from "../entities/person.entity.js";
import { FairStaff } from "../entities/fair-staff.js";
import type { PaginatedResult, PaginationParams } from "./types.js";

export async function findPeoplePaginated(
  dataSource: DataSource,
  params: PaginationParams & { search?: string; fairId?: string }
): Promise<PaginatedResult<Person>> {
  const query = params.search?.trim();
  const qb = dataSource.getRepository(Person).createQueryBuilder("person");

  if (params.fairId) {
    qb.innerJoin(
      FairStaff,
      "staff",
      "staff.person_id = person.id AND staff.fair_id = :fairId",
      { fairId: params.fairId }
    );
  }

  if (query) {
    qb.andWhere(
      "(person.name ILIKE :search OR person.last_name ILIKE :search OR person.email ILIKE :search)",
      { search: `%${query}%` }
    );
  }

  qb.distinct(true)
    .orderBy("person.last_name", "ASC")
    .addOrderBy("person.name", "ASC")
    .skip((params.page - 1) * params.limit)
    .take(params.limit);

  const [items, total] = await qb.getManyAndCount();

  return { items, total, page: params.page, limit: params.limit };
}

export async function findPersonById(
  dataSource: DataSource,
  id: string
): Promise<Person | null> {
  return dataSource.getRepository(Person).findOne({ where: { id } });
}
