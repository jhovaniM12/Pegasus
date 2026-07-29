import { Hono } from "hono";
import {
  getJudgingSystemSettingsController,
  updateJudgingSystemSettingsController
} from "../controllers/system-settings.controller.js";

export const systemSettingsRoutes = new Hono();

systemSettingsRoutes.get("/staff/system-settings/judging", getJudgingSystemSettingsController);
systemSettingsRoutes.patch("/staff/system-settings/judging", updateJudgingSystemSettingsController);
