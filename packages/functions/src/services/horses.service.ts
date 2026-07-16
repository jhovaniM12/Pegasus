import { getDataSource, Horse, type PaginatedResult, type PaginationParams } from "@pegasus/core";
import { ILike, type FindOptionsWhere } from "typeorm";

export async function listHorses(
  params: PaginationParams & { search?: string }
): Promise<PaginatedResult<Horse>> {
  const dataSource = await getDataSource();
  const normalizedSearch = params.search?.trim();
  const where: FindOptionsWhere<Horse> | FindOptionsWhere<Horse>[] = normalizedSearch
    ? [
        { name: ILike(`%${normalizedSearch}%`) },
        { registrationNumber: ILike(`%${normalizedSearch}%`) },
        { microchipNumber: ILike(`%${normalizedSearch}%`) }
      ]
    : {};

  const [items, total] = await dataSource.getRepository(Horse).findAndCount({
    where,
    order: { registrationNumber: "ASC" },
    skip: (params.page - 1) * params.limit,
    take: params.limit
  });

  return {
    items,
    total,
    page: params.page,
    limit: params.limit
  };
}
