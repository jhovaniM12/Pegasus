import type { Context } from "hono";
import { z } from "zod";
import { getHealthStatus } from "../services/health.service.js";

const healthResponseSchema = z.object({
  success: z.literal(true),
  service: z.literal("pegaso-api").or(z.string().min(1)),
  status: z.literal("healthy")
});

export function healthController(c: Context) {
  const response = healthResponseSchema.parse(getHealthStatus());

  c.header("Cache-Control", "no-store");
  return c.json(response);
}
