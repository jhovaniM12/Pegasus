import { Hono } from "hono";
import {
  createJudgingReminderController,
  deleteJudgingReminderController,
  getJudgingReminderController,
  listJudgingRemindersController,
  updateJudgingReminderController
} from "../controllers/judging-reminders.controller.js";

export const judgingRemindersRoutes = new Hono();

judgingRemindersRoutes.get("/judging-reminders", listJudgingRemindersController);
judgingRemindersRoutes.get("/judging-reminders/:id", getJudgingReminderController);
judgingRemindersRoutes.post("/judging-reminders", createJudgingReminderController);
judgingRemindersRoutes.patch("/judging-reminders/:id", updateJudgingReminderController);
judgingRemindersRoutes.delete("/judging-reminders/:id", deleteJudgingReminderController);
