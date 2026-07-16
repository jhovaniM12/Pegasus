import type { Context } from "hono";
import { z } from "zod";
import { buildPaginationMeta, success } from "../lib/http.js";
import { parsePaginationQuery } from "../lib/pagination.js";
import { toHorseDto } from "../mappers/horse.mapper.js";
import { listHorses } from "../services/horses.service.js";

const horsesQuerySchema = z.object({
  search: z.string().trim().optional()
});

export async function listHorsesController(c: Context) {
  const pagination = parsePaginationQuery(c.req.query());
  const query = horsesQuerySchema.parse(c.req.query());
  const result = await listHorses({ ...pagination, search: query.search });

  return c.json(
    success(
      result.items.map(toHorseDto),
      buildPaginationMeta(result.page, result.limit, result.total)
    )
  );
}
