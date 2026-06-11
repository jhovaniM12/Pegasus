import { z } from "zod";
import { BadRequestError } from "./errors.js";

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT)
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function parsePaginationQuery(
  query: Record<string, string | string[] | undefined>
): PaginationQuery {
  const result = paginationQuerySchema.safeParse(query);

  if (!result.success) {
    throw new BadRequestError("Parámetros de paginación inválidos.");
  }

  return result.data;
}
