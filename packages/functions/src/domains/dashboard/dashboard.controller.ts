import type { Context } from "hono";
import { success } from "../../http/lib/http.js";
import { getRootDashboardSummary } from "./dashboard.service.js";

export async function getRootDashboardSummaryController(c: Context) {
  const summary = await getRootDashboardSummary();
  return c.json(success(summary));
}
