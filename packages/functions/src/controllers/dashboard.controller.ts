import type { Context } from "hono";
import { success } from "../lib/http.js";
import { getRootDashboardSummary } from "../services/dashboard.service.js";

export async function getRootDashboardSummaryController(c: Context) {
  const summary = await getRootDashboardSummary();
  return c.json(success(summary));
}
