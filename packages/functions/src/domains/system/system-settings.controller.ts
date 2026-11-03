import type { Context } from "hono";
import { success } from "../../http/lib/http.js";
import { getSessionFromCookie } from "../../http/lib/session.js";
import { updateJudgingSystemSettingsSchema } from "./system-settings.schema.js";
import { getActiveRootUser } from "../auth/auth.service.js";
import {
  getJudgingSystemSettings,
  updateJudgingSystemSettings
} from "./system-settings.service.js";

export async function getJudgingSystemSettingsController(c: Context) {
  return c.json(success(await getJudgingSystemSettings()));
}

export async function updateJudgingSystemSettingsController(c: Context) {
  const session = getSessionFromCookie(c);
  await getActiveRootUser(session.userId);
  const payload = updateJudgingSystemSettingsSchema.parse(await c.req.json());
  return c.json(success(await updateJudgingSystemSettings(payload)));
}
