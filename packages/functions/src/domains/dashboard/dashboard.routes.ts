import { Hono } from "hono";
import { getRootDashboardSummaryController } from "./dashboard.controller.js";

export const dashboardRoutes = new Hono();

dashboardRoutes.get("/dashboard/summary", getRootDashboardSummaryController);
