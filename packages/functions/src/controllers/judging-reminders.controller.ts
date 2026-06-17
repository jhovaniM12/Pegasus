import type { Context } from "hono";
import { success } from "../lib/http.js";
import { uuidParamSchema } from "../schemas/common.schema.js";
import {
  createJudgingReminderSchema,
  judgingRemindersQuerySchema,
  updateJudgingReminderSchema
} from "../schemas/judging-reminders.schema.js";
import {
  createJudgingReminder,
  deleteJudgingReminder,
  getJudgingReminderById,
  listJudgingReminders,
  updateJudgingReminder
} from "../services/judging-reminders.service.js";

export async function listJudgingRemindersController(c: Context) {
  const query = judgingRemindersQuerySchema.parse(c.req.query());
  const isActive =
    query.isActive === "all" ? undefined : query.isActive === "true";
  const reminders = await listJudgingReminders({
    search: query.search,
    isActive
  });

  return c.json(success(reminders));
}

export async function getJudgingReminderController(c: Context) {
  const { id } = uuidParamSchema.parse(c.req.param());
  const reminder = await getJudgingReminderById(id);
  return c.json(success(reminder));
}

export async function createJudgingReminderController(c: Context) {
  const payload = createJudgingReminderSchema.parse(await c.req.json());
  const reminder = await createJudgingReminder(payload);
  return c.json(success(reminder), 201);
}

export async function updateJudgingReminderController(c: Context) {
  const { id } = uuidParamSchema.parse(c.req.param());
  const payload = updateJudgingReminderSchema.parse(await c.req.json());
  const reminder = await updateJudgingReminder(id, payload);
  return c.json(success(reminder));
}

export async function deleteJudgingReminderController(c: Context) {
  const { id } = uuidParamSchema.parse(c.req.param());
  await deleteJudgingReminder(id);
  return c.json(success({ id }));
}
