import type { Context } from "hono";
import { z } from "zod";
import { buildPaginationMeta, success } from "../lib/http.js";
import { BadRequestError } from "../lib/errors.js";
import { getSessionFromCookie } from "../lib/session.js";
import { parsePaginationQuery } from "../lib/pagination.js";
import { uuidParamSchema } from "../schemas/common.schema.js";
import {
  toSyncBatchDto,
  toSyncErrorDto,
  toSyncSummaryDto
} from "../mappers/sync.mapper.js";
import {
  cleanupDevelopmentSyncData,
  getSyncBatchById,
  listSyncBatches,
  listSyncErrors,
  listSyncSummaries,
  syncEntityFromCsv,
  type SyncRunFile
} from "../services/sync.service.js";

const entityParamSchema = z.object({
  entity: z.enum(["people", "horses", "fair_staff", "fair_entries"])
});

const batchesQuerySchema = z.object({
  entityName: z.enum(["people", "horses", "fair_staff", "fair_entries"]).optional(),
  status: z.enum(["PROCESSING", "COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"]).optional()
});
const cleanupConfirmationSchema = z.object({
  confirm: z.literal("DELETE_SYNC_DATA")
});

async function readMultipartFile(c: Context): Promise<SyncRunFile> {
  const body = await c.req.parseBody();
  const file = body.file;

  if (!(file instanceof File)) {
    throw new BadRequestError("Debe adjuntar un archivo CSV en el campo file.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  return {
    name: file.name,
    type: file.type,
    size: file.size,
    buffer
  };
}

export async function listSyncSummariesController(c: Context) {
  const summaries = await listSyncSummaries();

  return c.json(success(summaries.map(toSyncSummaryDto)));
}

export async function runSyncController(c: Context) {
  const { entity } = entityParamSchema.parse(c.req.param());
  const session = getSessionFromCookie(c);
  const file = await readMultipartFile(c);
  const batch = await syncEntityFromCsv(entity, file, session.userId);

  return c.json(success(toSyncBatchDto(batch)));
}

export async function listSyncBatchesController(c: Context) {
  const pagination = parsePaginationQuery({
    page: c.req.query("page"),
    limit: c.req.query("limit")
  });
  const filters = batchesQuerySchema.parse({
    entityName: c.req.query("entityName"),
    status: c.req.query("status")
  });
  const result = await listSyncBatches(pagination, filters);

  return c.json(
    success(
      result.items.map(toSyncBatchDto),
      buildPaginationMeta(pagination.page, pagination.limit, result.total)
    )
  );
}

export async function getSyncBatchController(c: Context) {
  const { id } = uuidParamSchema.parse(c.req.param());
  const batch = await getSyncBatchById(id);

  return c.json(success(toSyncBatchDto(batch)));
}

export async function listSyncErrorsController(c: Context) {
  const { id } = uuidParamSchema.parse(c.req.param());
  await getSyncBatchById(id);
  const pagination = parsePaginationQuery({
    page: c.req.query("page"),
    limit: c.req.query("limit")
  });
  const result = await listSyncErrors(id, pagination);

  return c.json(
    success(
      result.items.map(toSyncErrorDto),
      buildPaginationMeta(pagination.page, pagination.limit, result.total)
    )
  );
}

export async function cleanupSyncDevelopmentController(c: Context) {
  const body = cleanupConfirmationSchema.parse(await c.req.json());
  const session = getSessionFromCookie(c);
  const result = await cleanupDevelopmentSyncData(session.userId);

  return c.json(success({ ...result, confirm: body.confirm }));
}
