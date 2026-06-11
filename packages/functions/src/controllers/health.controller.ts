import type { Context } from "hono";
import { z } from "zod";
import { getHealthStatus } from "../services/health.service.js";

const healthResponseSchema = z.object({
  success: z.literal(true),
  service: z.literal("pegasus-api").or(z.string().min(1)),
  status: z.literal("healthy")
});

export function healthController(c: Context) {
  const response = healthResponseSchema.parse(getHealthStatus());

  return c.json(response);
}
