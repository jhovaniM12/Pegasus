import type { PaginatedResult } from "@pegasus/core";
import type { Context } from "hono";
import { buildPaginationMeta, success } from "./http.js";
import { parsePaginationQuery } from "./pagination.js";

export async function respondWithPaginatedList<TEntity, TDto>(
  c: Context,
  fetchPage: (params: { page: number; limit: number }) => Promise<PaginatedResult<TEntity>>,
  mapItem: (item: TEntity) => TDto
) {
  const pagination = parsePaginationQuery(c.req.query());
  const result = await fetchPage(pagination);

  return c.json(
    success(
      result.items.map(mapItem),
      buildPaginationMeta(result.page, result.limit, result.total)
    )
  );
}
