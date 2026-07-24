import type { DataSource, FindOptionsWhere } from "typeorm";
import { ILike, In } from "typeorm";
import { Person } from "../entities/person.entity.js";
import { FairStaff } from "../entities/fair-staff.js";
import type { PaginatedResult, PaginationParams } from "./types.js";

export async function findPeoplePaginated(
  dataSource: DataSource,
  params: PaginationParams & { search?: string; fairId?: string }
): Promise<PaginatedResult<Person>> {
  const query = params.search?.trim();
  const searchWhere: Array<FindOptionsWhere<Person>> | undefined = query
    ? [
        { name: ILike(`%${query}%`) },
        { lastName: ILike(`%${query}%`) },
        { email: ILike(`%${query}%`) }
      ]
    : undefined;

  let personIds: string[] | undefined;

  if (params.fairId) {
    const staffRows = await dataSource.getRepository(FairStaff).find({
      where: { fairId: params.fairId },
      select: { personId: true }
    });
    personIds = [...new Set(staffRows.map((row) => row.personId))];

    if (personIds.length === 0) {
      return { items: [], total: 0, page: params.page, limit: params.limit };
    }
  }

  const where: FindOptionsWhere<Person> | Array<FindOptionsWhere<Person>> | undefined = personIds
    ? searchWhere
      ? searchWhere.map((entry) => ({ ...entry, id: In(personIds) }))
      : { id: In(personIds) }
    : searchWhere;

  const [items, total] = await dataSource.getRepository(Person).findAndCount({
    where,
    order: { lastName: "ASC", name: "ASC" },
    skip: (params.page - 1) * params.limit,
    take: params.limit
  });

  return { items, total, page: params.page, limit: params.limit };
}

export async function findPersonById(
  dataSource: DataSource,
  id: string
): Promise<Person | null> {
  return dataSource.getRepository(Person).findOne({ where: { id } });
}
