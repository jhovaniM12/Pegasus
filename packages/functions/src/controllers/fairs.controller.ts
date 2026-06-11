import type { Context } from "hono";
import { z } from "zod";
import { success } from "../lib/http.js";
import { respondWithPaginatedList } from "../lib/paginated-response.js";
import { toFairEntryDto } from "../mappers/fair-entry.mapper.js";
import { toFairResultDto } from "../mappers/fair-result.mapper.js";
import { toFairStaffDto } from "../mappers/fair-staff.mapper.js";
import { toFairDto } from "../mappers/fair.mapper.js";
import { uuidParamSchema } from "../schemas/common.schema.js";
import {
  getFairEntriesSummary,
  getFairById,
  listFairEntries,
  listFairResults,
  listFairs,
  listFairStaff
} from "../services/fairs.service.js";

const fairEntriesQuerySchema = z.object({
  q: z.string().trim().optional(),
  categoryId: z.string().uuid("El identificador de categoría debe ser un UUID válido.").optional()
});

export async function listFairsController(c: Context) {
  return respondWithPaginatedList(c, listFairs, toFairDto);
}

export async function getFairController(c: Context) {
  const { id } = uuidParamSchema.parse(c.req.param());
  const fair = await getFairById(id);

  return c.json(success(toFairDto(fair)));
}

export async function listFairEntriesController(c: Context) {
  const { id } = uuidParamSchema.parse(c.req.param());
  const { q: search, categoryId } = fairEntriesQuerySchema.parse({
    q: c.req.query("q"),
    categoryId: c.req.query("categoryId")
  });

  return respondWithPaginatedList(
    c,
    (pagination) => listFairEntries(id, { ...pagination, search, categoryId }),
    toFairEntryDto
  );
}

export async function getFairEntriesSummaryController(c: Context) {
  const { id } = uuidParamSchema.parse(c.req.param());
  const summary = await getFairEntriesSummary(id);

  return c.json(success(summary));
}

export async function listFairResultsController(c: Context) {
  const { id } = uuidParamSchema.parse(c.req.param());

  return respondWithPaginatedList(
    c,
    (pagination) => listFairResults(id, pagination),
    toFairResultDto
  );
}

export async function listFairStaffController(c: Context) {
  const { id } = uuidParamSchema.parse(c.req.param());

  return respondWithPaginatedList(
    c,
    (pagination) => listFairStaff(id, pagination),
    toFairStaffDto
  );
}
