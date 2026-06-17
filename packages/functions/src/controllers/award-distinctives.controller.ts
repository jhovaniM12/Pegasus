import type { Context } from "hono";
import { success } from "../lib/http.js";
import { getSessionFromCookie } from "../lib/session.js";
import { uuidParamSchema } from "../schemas/common.schema.js";
import { updateAwardDistinctiveSchema } from "../schemas/award-distinctives.schema.js";
import { getActiveRootUser } from "../services/auth.service.js";
import {
  listAwardDistinctives,
  updateAwardDistinctive
} from "../services/award-distinctives.service.js";

export async function listAwardDistinctivesController(c: Context) {
  const session = getSessionFromCookie(c);
  await getActiveRootUser(session.userId);
  const distinctives = await listAwardDistinctives();
  return c.json(success(distinctives));
}

export async function updateAwardDistinctiveController(c: Context) {
  const session = getSessionFromCookie(c);
  await getActiveRootUser(session.userId);
  const { id } = uuidParamSchema.parse(c.req.param());
  const payload = updateAwardDistinctiveSchema.parse(await c.req.json());
  const row = await updateAwardDistinctive(id, payload);
  return c.json(success(row));
}
