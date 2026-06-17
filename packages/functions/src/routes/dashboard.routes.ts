import { Hono } from "hono";
import { getRootDashboardSummaryController } from "../controllers/dashboard.controller.js";

export const dashboardRoutes = new Hono();

dashboardRoutes.get("/dashboard/summary", getRootDashboardSummaryController);
