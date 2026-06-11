import type { DataSource, FindOptionsWhere } from "typeorm";
import { ILike } from "typeorm";
import { Person } from "../entities/person.entity.js";
import type { PaginatedResult, PaginationParams } from "./types.js";

export async function findPeoplePaginated(
  dataSource: DataSource,
  params: PaginationParams & { search?: string }
): Promise<PaginatedResult<Person>> {
  const query = params.search?.trim();
  const where: Array<FindOptionsWhere<Person>> | undefined = query
    ? [
        { name: ILike(`%${query}%`) },
        { lastName: ILike(`%${query}%`) },
        { email: ILike(`%${query}%`) }
      ]
    : undefined;

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
