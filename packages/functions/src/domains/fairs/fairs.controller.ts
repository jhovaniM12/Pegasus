import type { Context } from "hono";
import { z } from "zod";
import { success } from "../../http/lib/http.js";
import { respondWithPaginatedList } from "../../http/lib/paginated-response.js";
import { toFairEntryDto } from "./fair-entry.mapper.js";
import { toFairResultDto } from "./fair-result.mapper.js";
import { toFairStaffDto } from "./fair-staff.mapper.js";
import { toFairDto } from "./fair.mapper.js";
import { uuidParamSchema } from "../../shared/common.schema.js";
import {
  fairStaffParamsSchema,
  updateFairStaffJudgeSeatSchema
} from "./fair-staff.schema.js";
import {
  getFairEntriesSummary,
  getFairById,
  listFairEntries,
  listFairResults,
  listFairs,
  listFairStaff,
  updateFairStaffJudgeSeat
} from "./fairs.service.js";

const fairEntriesQuerySchema = z.object({
  q: z.string().trim().optional(),
  categoryId: z.string().uuid("El identificador de categoría debe ser un UUID válido.").optional()
});

const fairResultsQuerySchema = z.object({
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
  const { categoryId } = fairResultsQuerySchema.parse({
    categoryId: c.req.query("categoryId")
  });

  return respondWithPaginatedList(
    c,
    (pagination) => listFairResults(id, { ...pagination, categoryId }),
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

export async function updateFairStaffJudgeSeatController(c: Context) {
  const { id, staffId } = fairStaffParamsSchema.parse(c.req.param());
  const { judgeSeat } = updateFairStaffJudgeSeatSchema.parse(await c.req.json());
  const staff = await updateFairStaffJudgeSeat(id, staffId, judgeSeat);
  return c.json(success(toFairStaffDto(staff)));
}
